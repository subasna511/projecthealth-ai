import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pg from 'pg';
import { randomInt, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { projectRouter } from './projects.js';
import { insightsRouter } from './insights.js';
import { historyRouter } from './history.js';
import { startDailyMonitor } from './dailyMonitor.js';
import { runDailyRiskAssessment } from './insights.js';
import { asanaRouter } from './asana.js';
import { pushRouter } from './push.js';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in backend/.env`);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!
  }
});

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

app.use('/api/auth', limiter);

const loginSchema = z.object({
  email: z.string().email().max(255)
    .transform(value => value.toLowerCase().trim()),
  password: z.string().min(8)
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100)
});

const codeSchema = z.object({
  email: z.string().email()
    .transform(value => value.toLowerCase().trim()),
  code: z.string().regex(/^\d{6}$/)
});

const notificationSchema = z.object({
  notificationKey: z.string().min(1).max(500)
});

const sha = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
};

const handler = (
  fn: (req: express.Request, res: express.Response) => Promise<void>
) => (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  Promise.resolve(fn(req, res)).catch(next);
};

// Verify the current user from their session cookie.
function getUserId(req: express.Request): string | null {
  try {
    const token = req.cookies?.ph_session;

    if (!token) return null;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwt.JwtPayload;

    return typeof decoded.sub === 'string'
      ? decoded.sub
      : null;
  } catch {
    return null;
  }
}

// ---------------- HEALTH ----------------

app.get('/api/health', handler(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

// ---------------- REGISTRATION ----------------

app.post('/api/auth/register', handler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Enter a name, valid email and password of at least 8 characters.'
    });
    return;
  }

  const { name, email, password } = parsed.data;

  const exists = await pool.query(
    'SELECT id FROM users WHERE email=$1',
    [email]
  );

  if (exists.rowCount) {
    res.status(409).json({
      error: 'An account with this email already exists.'
    });
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      'INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',
      [randomUUID(), name, email, hash]
    );
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === '23505'
    ) {
      res.status(409).json({
        error: 'An account with this email already exists.'
      });
      return;
    }

    throw err;
  }

  res.status(201).json({
    message: 'Account created. Please sign in.'
  });
}));

// ---------------- LOGIN ----------------

app.post('/api/auth/login', handler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Enter a valid email and password.'
    });
    return;
  }

  const { email, password } = parsed.data;

  const found = await pool.query(
    'SELECT id,password_hash FROM users WHERE email=$1',
    [email]
  );

  const valid = found.rowCount
    ? await bcrypt.compare(password, found.rows[0].password_hash)
    : false;

  if (!valid) {
    res.status(401).json({
      error: 'Invalid email or password.'
    });
    return;
  }

  const userId = found.rows[0].id;
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const id = randomUUID();

  await pool.query(
    'DELETE FROM login_codes WHERE user_id=$1',
    [userId]
  );

  await pool.query(
    `INSERT INTO login_codes(id,user_id,code_hash,expires_at)
     VALUES($1,$2,$3,NOW()+INTERVAL '5 minutes')`,
    [id, userId, sha(`${id}:${code}:${process.env.JWT_SECRET}`)]
  );

  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM!,
      to: email,
      subject: 'ProjectHealth AI — your login verification code',
      text: `Your ProjectHealth AI verification code is ${code}. It expires in 5 minutes. If you did not sign in, ignore this email.`
    });
  } catch (err) {
    console.error('OTP email delivery failed:', err);

    await pool.query(
      'DELETE FROM login_codes WHERE id=$1',
      [id]
    );

    res.status(503).json({
      error: 'Unable to send email. Check SMTP configuration and try again.'
    });
    return;
  }

  res.json({
    message: 'Verification code sent to your email.',
    email
  });
}));

// ---------------- VERIFY OTP ----------------

app.post('/api/auth/verify', handler(async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Enter a valid six-digit code.'
    });
    return;
  }

  const { email, code } = parsed.data;

  const result = await pool.query(
    `SELECT
       c.id,
       c.code_hash,
       c.attempts,
       c.expires_at,
       u.id AS user_id,
       u.name,
       u.email
     FROM login_codes c
     JOIN users u ON u.id=c.user_id
     WHERE u.email=$1 AND c.consumed_at IS NULL
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [email]
  );

  if (!result.rowCount) {
    res.status(401).json({
      error: 'No active code. Sign in again.'
    });
    return;
  }

  const row = result.rows[0];

  if (
    new Date(row.expires_at).getTime() < Date.now() ||
    row.attempts >= 5
  ) {
    res.status(401).json({
      error: 'Code expired or too many attempts. Sign in again.'
    });
    return;
  }

  const updated = await pool.query(
    `UPDATE login_codes
     SET attempts=attempts+1,
         consumed_at=CASE
           WHEN code_hash=$2 THEN NOW()
           ELSE consumed_at
         END
     WHERE id=$1
       AND consumed_at IS NULL
       AND attempts<5
       AND expires_at>NOW()
     RETURNING consumed_at`,
    [
      row.id,
      sha(`${row.id}:${code}:${process.env.JWT_SECRET}`)
    ]
  );

  if (!updated.rowCount || !updated.rows[0].consumed_at) {
    res.status(401).json({
      error: 'Incorrect or expired verification code.'
    });
    return;
  }

  const token = jwt.sign(
    { sub: row.user_id },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  res.cookie('ph_session', token, cookieOpts);

  res.json({
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email
    }
  });
}));

// ---------------- CURRENT USER ----------------

app.get('/api/auth/me', handler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      error: 'Not signed in or session expired'
    });
    return;
  }

  const found = await pool.query(
    'SELECT id,name,email FROM users WHERE id=$1',
    [userId]
  );

  if (!found.rowCount) {
    res.status(401).json({
      error: 'User not found'
    });
    return;
  }

  res.json({
    user: found.rows[0]
  });
}));

// ---------------- LOGOUT ----------------

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('ph_session', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  res.json({
    message: 'Signed out'
  });
});
// ---------------- WEB PUSH NOTIFICATIONS ----------------

app.use('/api', pushRouter(pool));

// ---------------- PROJECTS ----------------

app.use('/api', projectRouter(pool));




// ---------------- AI INSIGHTS ----------------

app.use('/api', insightsRouter(pool));
app.use('/api', historyRouter(pool));
app.use('/api', asanaRouter(pool));
app.use('/api', pushRouter(pool));

// ---------------- GET READ NOTIFICATIONS ----------------

app.get('/api/notifications/read', handler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      error: 'Sign in first'
    });
    return;
  }

  const result = await pool.query(
    `SELECT notification_key
     FROM notification_reads
     WHERE user_id = $1`,
    [userId]
  );

  res.json(
    result.rows.map(row => row.notification_key)
  );
}));

// ---------------- MARK AS READ ----------------

app.post('/api/notifications/read', handler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      error: 'Sign in first'
    });
    return;
  }

  const parsed = notificationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid notification key'
    });
    return;
  }

  await pool.query(
    `INSERT INTO notification_reads (user_id, notification_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id, notification_key)
     DO UPDATE SET read_at = NOW()`,
    [userId, parsed.data.notificationKey]
  );

  res.json({
    success: true,
    read: true
  });
}));

// ---------------- MARK AS UNREAD ----------------

app.post('/api/notifications/unread', handler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      error: 'Sign in first'
    });
    return;
  }

  const parsed = notificationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid notification key'
    });
    return;
  }

  await pool.query(
    `DELETE FROM notification_reads
     WHERE user_id = $1 AND notification_key = $2`,
    [userId, parsed.data.notificationKey]
  );

  res.json({
    success: true,
    read: false
  });
}));

// ---------------- ERROR HANDLER ----------------

app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error(err);

  res.status(500).json({
    error: 'Unexpected server error'
  });
});

// ---------------- START SERVER ----------------

const port = Number(process.env.PORT || 4000);

pool.query('SELECT 1')
  .then(() => {
    app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`);
      startDailyMonitor(() => runDailyRiskAssessment(pool));
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
