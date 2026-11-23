
import { Router } from 'express';
import type { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export function historyRouter(pool: Pool) {
  const router = Router();

  router.get('/history/:projectId', async (req, res) => {
    try {
      const token = req.cookies?.ph_session;

      if (!token) {
        return res.status(401).json({
          error: 'Sign in first'
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as jwt.JwtPayload;

      if (typeof decoded.sub !== 'string') {
        return res.status(401).json({
          error: 'Invalid session'
        });
      }

      const projectId = req.params.projectId;

      const result = await pool.query(
        `SELECT
           h.recorded_date::text AS recorded_date,
           h.health_score,
           h.risk_level,
           h.ml_prediction,
           h.ml_confidence,
           h.completion_percentage
         FROM project_risk_history h
         JOIN projects p
           ON p.id = h.project_id
         WHERE h.project_id = $1
           AND (
             p.owner_id = $2
             OR EXISTS (
               SELECT 1
               FROM project_members pm
               WHERE pm.project_id = p.id
                 AND pm.user_id = $2
             )
           )
         ORDER BY h.recorded_date ASC`,
        [projectId, decoded.sub]
      );

      return res.json(result.rows);
    } catch (error) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError
      ) {
        return res.status(401).json({
          error: 'Invalid or expired session'
        });
      }

      console.error('History API error:', error);

      return res.status(500).json({
        error: 'Unable to load project history'
      });
    }
  });

  return router;
}
