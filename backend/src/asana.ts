import { Router, type Request, type Response, type NextFunction } from 'express';
import type pg from 'pg';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { calculateProjectInsights } from './insights.js';

const API = 'https://app.asana.com/api/1.0';
const ASANA_AUTHORIZE = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN = 'https://app.asana.com/-/oauth_token';

type AsanaItem = { gid: string; name: string };
type AsanaPage = { data: AsanaItem[]; next_page?: { uri?: string | null } | null };

function config() {
  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;
  const redirectUri = process.env.ASANA_REDIRECT_URI;
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    throw new Error('Missing Asana OAuth configuration');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters');
  }
  return { clientId, clientSecret, redirectUri, key: Buffer.from(encryptionKey, 'hex') };
}

function encrypt(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(x => x.toString('base64url')).join('.');
}

function decrypt(value: string, key: Buffer): string {
  const [iv, tag, body] = value.split('.');
  if (!iv || !tag || !body) throw new Error('Invalid encrypted token');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(body, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireUser(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.ph_session;
    if (!token) { res.status(401).json({ error: 'Sign in first' }); return; }
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'Invalid session' }); return;
    }
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

async function getAsanaAccessToken(pool: pg.Pool, userId: string): Promise<string> {
  const { clientId, clientSecret, key } = config();
  const result = await pool.query(
    `SELECT access_token_encrypted, refresh_token_encrypted, token_expires_at
     FROM asana_connections WHERE user_id = $1`, [userId]
  );
  if (!result.rowCount) throw new Error('ASANA_NOT_CONNECTED');
  const connection = result.rows[0];
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime() : null;
  // An absent expiry is treated as unknown: try the existing token, and
  // rely on an Asana 401 response to request reconnection if needed.
  if (expiresAt === null || expiresAt > Date.now() + 60000) {
    return decrypt(connection.access_token_encrypted, key);
  }
  if (!connection.refresh_token_encrypted) throw new Error('ASANA_RECONNECT_REQUIRED');
  const refreshToken = decrypt(connection.refresh_token_encrypted, key);
  const response = await fetch(ASANA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: clientId,
      client_secret: clientSecret, refresh_token: refreshToken
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('ASANA_RECONNECT_REQUIRED');
  const token = await response.json() as {
    access_token?: string; refresh_token?: string; expires_in?: number
  };
  if (!token.access_token) throw new Error('ASANA_RECONNECT_REQUIRED');
  await pool.query(
    `UPDATE asana_connections
     SET access_token_encrypted=$1, refresh_token_encrypted=$2,
         token_expires_at=$3, updated_at=NOW() WHERE user_id=$4`,
    [encrypt(token.access_token, key),
     encrypt(token.refresh_token ?? refreshToken, key),
     typeof token.expires_in === 'number'
       ? new Date(Date.now() + token.expires_in * 1000) : null,
     userId]
  );
  return token.access_token;
}

async function getAsanaItems(token: string, startUrl: string): Promise<AsanaItem[]> {
  const items: AsanaItem[] = [];
  let nextUrl: string | null = startUrl;
  let pageCount = 0;
  while (nextUrl) {
    if (++pageCount > 100) throw new Error('Asana pagination limit reached');
    const url = new URL(nextUrl);
    if (url.origin !== 'https://app.asana.com' || !url.pathname.startsWith('/api/1.0/')) {
      throw new Error('Unexpected Asana pagination URL');
    }
    const response: globalThis.Response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const raw = await response.text();
      let detail = '';
      try {
        const parsed = JSON.parse(raw) as { errors?: Array<{ message?: string }> };
        detail = parsed.errors?.map(e => e.message).filter(Boolean).join('; ') ?? '';
      } catch { /* Do not expose untrusted HTML or raw error bodies. */ }
      if (response.status === 401) throw new Error('ASANA_RECONNECT_REQUIRED');
      const error = new Error(`Asana API returned ${response.status}${detail ? `: ${detail.slice(0, 250)}` : ''}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    const page = await response.json() as AsanaPage;
    if (!Array.isArray(page.data)) throw new Error('Unexpected Asana response');
    items.push(...page.data);
    nextUrl = page.next_page?.uri ?? null;
  }
  return items;
}

function handleAsanaError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof Error) {
    if (error.message === 'ASANA_NOT_CONNECTED') {
      res.status(401).json({ error: 'Connect Asana first' }); return;
    }
    if (error.message === 'ASANA_RECONNECT_REQUIRED') {
      res.status(401).json({ error: 'Asana authorization expired. Please reconnect.' }); return;
    }
    const status = (error as Error & { status?: number }).status;
    if (status) {
      res.status(502).json({ error: error.message }); return;
    }
  }
  next(error);
}

export function asanaRouter(pool: pg.Pool) {
  const router = Router();
  router.use(requireUser);

  router.get('/asana/connect', async (_req, res, next) => {
    try {
      const { clientId, redirectUri, key } = config();
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      await pool.query(
        `INSERT INTO asana_oauth_states (state_hash, user_id, code_verifier_encrypted, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [sha256(state), res.locals.userId, encrypt(verifier, key)]
      );
      const url = new URL(ASANA_AUTHORIZE);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('scope', 'projects:read tasks:read users:read workspaces:read');
      res.redirect(url.toString());
    } catch (error) { next(error); }
  });

  router.get('/asana/status', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT asana_user_gid, asana_user_name, connected_at
         FROM asana_connections WHERE user_id = $1`, [res.locals.userId]
      );
      res.json({ connected: result.rowCount !== 0, account: result.rows[0] ?? null });
    } catch (error) { next(error); }
  });

  router.get('/asana/callback', async (req, res, next) => {
    try {
      const { clientId, clientSecret, redirectUri, key } = config();
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      if (!state || !code) {
        res.status(400).send('Asana authorization was cancelled or incomplete.'); return;
      }
      const client = await pool.connect();
      let encryptedVerifier: string;
      try {
        await client.query('BEGIN');
        const lookup = await client.query(
          `SELECT code_verifier_encrypted FROM asana_oauth_states
           WHERE state_hash = $1 AND user_id = $2 AND expires_at > NOW() FOR UPDATE`,
          [sha256(state), res.locals.userId]
        );
        if (!lookup.rowCount) {
          await client.query('ROLLBACK');
          res.status(400).send('Invalid or expired Asana connection request.'); return;
        }
        encryptedVerifier = lookup.rows[0].code_verifier_encrypted;
        await client.query('DELETE FROM asana_oauth_states WHERE state_hash = $1', [sha256(state)]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      const verifier = decrypt(encryptedVerifier!, key);
      const tokenResponse = await fetch(ASANA_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', client_id: clientId,
          client_secret: clientSecret, redirect_uri: redirectUri,
          code, code_verifier: verifier
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!tokenResponse.ok) throw new Error(`Asana token exchange failed (${tokenResponse.status})`);
      const token = await tokenResponse.json() as {
        access_token?: string; refresh_token?: string; expires_in?: number
      };
      if (!token.access_token) throw new Error('Asana did not return an access token');
      const meResponse = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10000)
      });
      if (!meResponse.ok) throw new Error(`Asana account lookup failed (${meResponse.status})`);
      const me = await meResponse.json() as { data: { gid: string; name?: string } };
      await pool.query(
        `INSERT INTO asana_connections
         (user_id, asana_user_gid, asana_user_name, access_token_encrypted,
          refresh_token_encrypted, token_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           asana_user_gid = EXCLUDED.asana_user_gid,
           asana_user_name = EXCLUDED.asana_user_name,
           access_token_encrypted = EXCLUDED.access_token_encrypted,
           refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
           token_expires_at = EXCLUDED.token_expires_at,
           updated_at = NOW()`,
        [res.locals.userId, me.data.gid, me.data.name ?? null,
         encrypt(token.access_token, key),
         token.refresh_token ? encrypt(token.refresh_token, key) : null,
         typeof token.expires_in === 'number'
           ? new Date(Date.now() + token.expires_in * 1000) : null]
      );
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?asana=connected`);
    } catch (error) { next(error); }
  });

  router.get('/asana/workspaces', async (_req, res, next) => {
    try {
      const token = await getAsanaAccessToken(pool, res.locals.userId);
      const workspaces = await getAsanaItems(
        token, `${API}/workspaces?limit=100&opt_fields=gid,name`
      );
      res.json({ data: workspaces });
    } catch (error) { handleAsanaError(error, res, next); }
  });

  
router.get('/asana/projects', async (_req, res, next) => {
  try {
    const userId: string = res.locals.userId;
    const token = await getAsanaAccessToken(pool, userId);

    // Fetch Asana workspaces.
    const workspaces = await getAsanaItems(
      token,
      `${API}/workspaces?limit=100&opt_fields=gid,name`
    );

    // Fetch Asana projects from each workspace.
    const projects: Array<
      AsanaItem & {
        workspace_gid: string;
        workspace_name: string;
      }
    > = [];

    for (const workspace of workspaces) {
      const url = new URL(`${API}/projects`);

      url.searchParams.set('workspace', workspace.gid);
      url.searchParams.set('limit', '100');
      url.searchParams.set('opt_fields', 'gid,name');

      const list = await getAsanaItems(token, url.toString());

      projects.push(
        ...list.map(project => ({
          ...project,
          workspace_gid: workspace.gid,
          workspace_name: workspace.name
        }))
      );
    }

    // Retrieve synchronization records for this user.
    const result = await pool.query<{
      asana_project_gid: string;
      project_id: string;
      last_synced_at: Date | null;
    }>(
      `SELECT asana_project_gid, project_id, last_synced_at
       FROM asana_project_links
       WHERE user_id = $1`,
      [userId]
    );

    const syncMap = new Map(
      result.rows.map(row => [
        row.asana_project_gid,
        {
          project_id: row.project_id,
          last_synced_at: row.last_synced_at
        }
      ])
    );

    // Combine Asana projects with local synchronization data.
    const projectsWithSync = projects.map(project => {
      const sync = syncMap.get(project.gid);

      return {
        ...project,
        imported: Boolean(sync),
        local_project_id: sync?.project_id ?? null,
        last_synced_at: sync?.last_synced_at ?? null
      };
    });

    res.json({ projects: projectsWithSync });

  } catch (error) {
    handleAsanaError(error, res, next);
  }
});

// Import or synchronize an Asana project and its tasks.
  router.post('/asana/projects/:gid/import', async (req, res, next) => {
  const gid = req.params.gid;
  if (typeof gid !== 'string' || !/^\d{1,30}$/.test(gid)) {
    res.status(400).json({ error: 'Invalid Asana project ID' }); return;
  }

  try {
    const userId: string = res.locals.userId;
    const token = await getAsanaAccessToken(pool, userId);

    // Verify the selected project is accessible to the connected account.
    const detail = await fetch(`${API}/projects/${gid}?opt_fields=gid,name,notes,due_on`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!detail.ok) {
      res.status(502).json({ error: `Could not read Asana project (${detail.status})` });
      return;
    }
    const projectBody = await detail.json() as {
      data: { gid: string; name: string; notes?: string | null; due_on?: string | null }
    };
    const project = projectBody.data;
    if (!project || project.gid !== gid || !project.name?.trim()) {
      res.status(502).json({ error: 'Unexpected Asana project response' }); return;
    }

    // Fetch ALL task pages before opening a database transaction.
    type RemoteTask = {
      gid: string; name: string; notes?: string | null;
      completed?: boolean; due_on?: string | null;
    };
    const tasks: RemoteTask[] = [];
    let nextUrl: string | null = `${API}/projects/${gid}/tasks?limit=100&opt_fields=gid,name,notes,completed,due_on`;
    let pages = 0;
    while (nextUrl) {
      if (++pages > 100) throw new Error('Asana task pagination limit reached');
      const url = new URL(nextUrl);
      if (url.origin !== 'https://app.asana.com' || !url.pathname.startsWith('/api/1.0/')) {
        throw new Error('Unexpected Asana pagination URL');
      }
      const response: globalThis.Response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        res.status(502).json({ error: `Could not read Asana tasks (${response.status})` });
        return;
      }
      const page = await response.json() as {
        data: RemoteTask[]; next_page?: { uri?: string | null } | null
      };
      if (!Array.isArray(page.data)) throw new Error('Unexpected Asana tasks response');
      tasks.push(...page.data);
      nextUrl = page.next_page?.uri ?? null;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize imports of this same Asana project for this user.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [userId, gid]);
      let link = await client.query(
        `SELECT id, project_id FROM asana_project_links
         WHERE user_id=$1 AND asana_project_gid=$2 FOR UPDATE`, [userId, gid]
      );
      let projectId: string;
      let linkId: number;
      let createdProject = false;
      if (link.rowCount) {
        projectId = link.rows[0].project_id;
        linkId = link.rows[0].id;
      } else {
        projectId = randomUUID();
        await client.query(
          `INSERT INTO projects(id,owner_id,name,description,due_date)
           VALUES($1,$2,$3,$4,$5)`,
          [projectId, userId, project.name.slice(0, 150), (project.notes ?? '').slice(0, 3000), project.due_on ?? null]
        );
        await client.query(
          `INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner')`,
          [projectId, userId]
        );
        const inserted = await client.query(
          `INSERT INTO asana_project_links(user_id,asana_project_gid,project_id)
           VALUES($1,$2,$3) RETURNING id`, [userId, gid, projectId]
        );
        linkId = inserted.rows[0].id;
        createdProject = true;
      }

      let createdTasks = 0;
      let updatedTasks = 0;
      for (const task of tasks) {
        if (!task.gid || !task.name?.trim()) continue;
        const existing = await client.query(
          `SELECT task_id FROM asana_task_links
           WHERE project_link_id=$1 AND asana_task_gid=$2`, [linkId, task.gid]
        );
        const title = task.name.slice(0, 200);
        const description = (task.notes ?? '').slice(0, 3000);
        const status = task.completed ? 'done' : 'todo';
        const dueDate = task.due_on ?? null;
        if (existing.rowCount) {
          await client.query(
            `UPDATE tasks SET title=$1,description=$2,status=$3,due_date=$4,updated_at=NOW()
             WHERE id=$5 AND project_id=$6`,
            [title, description, status, dueDate, existing.rows[0].task_id, projectId]
          );
          updatedTasks++;
        } else {
          const taskId = randomUUID();
          await client.query(
            `INSERT INTO tasks(id,project_id,title,description,status,priority,due_date)
             VALUES($1,$2,$3,$4,$5,'medium',$6)`,
            [taskId, projectId, title, description, status, dueDate]
          );
          await client.query(
            `INSERT INTO asana_task_links(project_link_id,asana_task_gid,task_id)
             VALUES($1,$2,$3)`, [linkId, task.gid, taskId]
          );
          createdTasks++;
        }
      }
      await client.query(
        `UPDATE asana_project_links SET last_synced_at=NOW() WHERE id=$1`, [linkId]
      );
      await client.query('COMMIT');

// Automatically recalculate AI risk after successful Asana sync.
let analysisUpdated = false;

try {
  await calculateProjectInsights(pool, userId);
  analysisUpdated = true;
} catch (analysisError) {
  console.error('AI analysis after Asana sync failed:', analysisError);
}

// Return the synchronization results.
res.json({
  ok: true,
  project_id: projectId,
  created_project: createdProject,
  created_tasks: createdTasks,
  updated_tasks: updatedTasks,
  analysis_updated: analysisUpdated
});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) { handleAsanaError(error, res, next); }
});
  router.post('/asana/disconnect', async (_req, res, next) => {
    try {
      await pool.query('DELETE FROM asana_connections WHERE user_id = $1', [res.locals.userId]);
      res.json({ connected: false });
    } catch (error) { next(error); }
  });
  return router;
}
