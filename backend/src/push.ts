
import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import * as webpush from 'web-push';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const router = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048)
    .refine(value => value.startsWith('https://')),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(10).max(256)
  })
});

function getUserId(req: Request): string | null {
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

export function pushRouter(pool: Pool) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing Web Push VAPID configuration');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  router.get('/push/public-key', (_req, res) => {
    res.json({ publicKey });
  });

  router.post('/push/subscribe', async (req, res, next) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: 'Sign in first' });
        return;
      }

      const parsed = subscriptionSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid subscription' });
        return;
      }

      const { endpoint, keys } = parsed.data;

      await pool.query(
        `INSERT INTO push_subscriptions
         (id, user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint)
         DO UPDATE SET
           user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           updated_at = NOW()`,
        [randomUUID(), userId, endpoint, keys.p256dh, keys.auth]
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/push/unsubscribe', async (req, res, next) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: 'Sign in first' });
        return;
      }

      const parsed = z.object({
        endpoint: z.string().url().max(2048)
      }).safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid endpoint' });
        return;
      }

      await pool.query(
        `DELETE FROM push_subscriptions
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, parsed.data.endpoint]
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/push/test', async (req, res, next) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: 'Sign in first' });
        return;
      }

      const result = await pool.query(
        `SELECT endpoint, p256dh, auth
         FROM push_subscriptions
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rowCount === 0) {
        res.status(400).json({
          error: 'No subscribed devices'
        });
        return;
      }

      let sent = 0;

      for (const subscription of result.rows) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            JSON.stringify({
              title: 'ProjectHealth AI',
              body: 'Your Web Push Notifications are working!',
              url: '/'
            })
          );

          sent++;
        } catch (error: any) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pool.query(
              `DELETE FROM push_subscriptions
               WHERE user_id = $1 AND endpoint = $2`,
              [userId, subscription.endpoint]
            );
          } else {
            console.error('Push delivery failed:', error);
          }
        }
      }

      res.json({
        success: sent > 0,
        sent,
        total: result.rows.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
