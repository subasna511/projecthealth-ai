import {
  Router,
  type Request,
  type Response,
  type NextFunction
} from 'express';
import type pg from 'pg';
import jwt from 'jsonwebtoken';

type RiskLevel = 'Low' | 'Medium' | 'High';

type MLPrediction = {
  predicted_risk: string;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  training_data: string;
};

export function insightsRouter(pool: pg.Pool) {
  const router = Router();

  // Authenticate users
  router.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.ph_session;

      if (!token) {
        res.status(401).json({ error: 'Sign in first' });
        return;
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as jwt.JwtPayload;

      if (typeof decoded.sub !== 'string') {
        res.status(401).json({ error: 'Invalid session' });
        return;
      }

      res.locals.userId = decoded.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired' });
    }
  });

  router.get('/insights', async (_req, res, next) => {
    try {
      const insights = await calculateProjectInsights(pool, res.locals.userId);
      res.json(insights);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// Shared calculation for authenticated requests and the internal daily scheduler.
export async function calculateProjectInsights(
  pool: pg.Pool,
  userId: string | null
) {
      // STEP 1: Get project and task information
      const result = await pool.query(`
        SELECT
          p.id,
          p.name,
          p.due_date,

          COUNT(t.id)::int AS total_tasks,

          COUNT(t.id) FILTER (
            WHERE t.status = 'done'
          )::int AS completed_tasks,

          COUNT(t.id) FILTER (
            WHERE t.status != 'done'
              AND t.due_date < CURRENT_DATE
          )::int AS overdue_tasks,

          COUNT(t.id) FILTER (
            WHERE t.status != 'done'
              AND t.due_date >= CURRENT_DATE
              AND t.due_date <= CURRENT_DATE + 3
          )::int AS upcoming_tasks,

          COUNT(t.id) FILTER (
            WHERE t.status != 'done'
              AND t.assignee_id IS NULL
          )::int AS unassigned_tasks,

          COUNT(t.id) FILTER (
            WHERE t.status = 'in_progress'
          )::int AS in_progress_tasks,

          (
            SELECT COUNT(*)::int
            FROM project_members pm
            WHERE pm.project_id = p.id
          ) AS team_members,

          (
            SELECT COUNT(*)::int
            FROM (
              SELECT t2.assignee_id
              FROM tasks t2
              WHERE t2.project_id = p.id
                AND t2.status != 'done'
                AND t2.assignee_id IS NOT NULL
              GROUP BY t2.assignee_id
            ) assigned_members
          ) AS active_assignees,

          (
            SELECT COALESCE(MAX(task_count), 0)::int
            FROM (
              SELECT COUNT(*) AS task_count
              FROM tasks t3
              WHERE t3.project_id = p.id
                AND t3.status != 'done'
                AND t3.assignee_id IS NOT NULL
              GROUP BY t3.assignee_id
            ) workload
          ) AS max_member_tasks

        FROM projects p

        LEFT JOIN tasks t
          ON t.project_id = p.id

        WHERE (
          $1::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = $1::uuid
          )
        )

        GROUP BY p.id, p.name, p.due_date
        ORDER BY p.name
      `, [userId]);

      // STEP 2: Calculate rule-based health scores
      const insights = result.rows.map(project => {
        const total = Number(project.total_tasks);
        const completed = Number(project.completed_tasks);
        const overdue = Number(project.overdue_tasks);
        const upcoming = Number(project.upcoming_tasks);
        const unassigned = Number(project.unassigned_tasks);
        const inProgress = Number(project.in_progress_tasks);
        const members = Number(project.team_members);
        const activeAssignees = Number(project.active_assignees);
        const maxMemberTasks = Number(project.max_member_tasks);

        const unfinished = total - completed;
        const assignedUnfinished = unfinished - unassigned;

        const completionRate =
          total > 0 ? completed / total : 0;

        const overdueRate =
          total > 0 ? overdue / total : 0;

        const upcomingRate =
          total > 0 ? upcoming / total : 0;

        const unassignedRate =
          total > 0 ? unassigned / total : 0;

        // Health score calculation
        let score = 70;

        score += completionRate * 30;
        score -= overdueRate * 45;
        score -= upcomingRate * 15;
        score -= unassignedRate * 10;

        // Project deadline analysis
        let daysLeft: number | null = null;

        if (project.due_date) {
          const dateString =
            project.due_date instanceof Date
              ? project.due_date.toISOString().slice(0, 10)
              : String(project.due_date).slice(0, 10);

          const deadlineTime = Date.parse(
            `${dateString}T00:00:00Z`
          );

          const now = new Date();

          const todayTime = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
          );

          daysLeft = Math.round(
            (deadlineTime - todayTime) / 86400000
          );

          if (unfinished > 0) {
            if (daysLeft < 0) {
              score -= 20;
            } else if (daysLeft <= 3) {
              score -= 10;
            }
          }
        }

        // Team workload analysis
        const workloadConcentration =
          assignedUnfinished > 0
            ? maxMemberTasks / assignedUnfinished
            : 0;

        const workloadImbalance =
          members > 1 &&
          activeAssignees > 0 &&
          assignedUnfinished >= 3 &&
          workloadConcentration >= 0.7;

        if (workloadImbalance) {
          score -= 10;
        }

        score = Math.max(
          0,
          Math.min(100, Math.round(score))
        );

        if (total === 0) {
          score = 50;
        }

        // Risk classification
        const risk: RiskLevel =
          score >= 75
            ? 'Low'
            : score >= 45
            ? 'Medium'
            : 'High';

        // Risk factors and recommendations
        const riskFactors: string[] = [];
        const recommendations: string[] = [];

        if (total === 0) {
          riskFactors.push(
            'Insufficient task data for a reliable assessment.'
          );

          recommendations.push(
            'Create project tasks and assign deadlines to begin monitoring progress.'
          );
        }

        if (overdue > 0) {
          riskFactors.push(
            `${overdue} overdue task(s) detected.`
          );

          recommendations.push(
            'Prioritise overdue tasks and review their deadlines.'
          );
        }

        if (upcoming > 0) {
          riskFactors.push(
            `${upcoming} unfinished task(s) are due within 3 days.`
          );

          recommendations.push(
            'Review upcoming deadlines and complete urgent tasks first.'
          );
        }

        if (unassigned > 0) {
          riskFactors.push(
            `${unassigned} unfinished task(s) have no assignee.`
          );

          recommendations.push(
            'Assign unfinished tasks to responsible team members.'
          );
        }

        if (workloadImbalance) {
          riskFactors.push(
            'Most assigned unfinished tasks belong to one team member.'
          );

          recommendations.push(
            'Redistribute tasks to balance the team workload.'
          );
        }

        if (daysLeft !== null && unfinished > 0) {
          if (daysLeft < 0) {
            riskFactors.push(
              'The project deadline has passed.'
            );

            recommendations.push(
              'Review the project schedule and address unfinished work immediately.'
            );
          } else if (daysLeft <= 3) {
            riskFactors.push(
              `The project deadline is only ${daysLeft} day(s) away.`
            );

            recommendations.push(
              'Focus on critical remaining tasks before the project deadline.'
            );
          }
        }

        if (total > 0 && completed === total) {
          recommendations.push(
            'All tasks are completed. Project progress is on track.'
          );
        }

        if (recommendations.length === 0) {
          recommendations.push(
            'Continue monitoring project progress, workload and deadlines.'
          );
        }

        // Early warning detection
        const earlyWarning =
          overdue > 0 ||
          (upcoming > 0 && completionRate < 0.75) ||
          unassigned > 0 ||
          workloadImbalance ||
          (daysLeft !== null &&
            daysLeft <= 3 &&
            unfinished > 0);

        return {
          ...project,

          health_score: score,
          risk_level: risk,
          recommendations,

          completion_percentage: Math.round(
            completionRate * 100
          ),

          in_progress_tasks: inProgress,
          unfinished_tasks: unfinished,
          active_assignees: activeAssignees,
          workload_imbalance: workloadImbalance,

          workload_concentration: Math.round(
            workloadConcentration * 100
          ),

          days_until_deadline: daysLeft,
          early_warning: earlyWarning,
          risk_factors: riskFactors,

          prediction_method: 'Rule-based risk assessment'
        };
      });

      // STEP 3: Get predictions from Python ML service
      const insightsWithML = await Promise.all(
        insights.map(async project => {
          const total = Number(project.total_tasks);

          // No ML prediction if no tasks exist
          if (total === 0) {
            return {
              ...project,
              ml_prediction: null,
              ml_confidence: null,
              ml_probabilities: null,
              ml_model: null,
              ml_training_data: null
            };
          }

          try {
            const response = await fetch(
              process.env.ML_SERVICE_URL ??
                'http://127.0.0.1:8000/predict',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                  completion_rate:
                    Number(project.completed_tasks) / total,

                  overdue_rate:
                    Number(project.overdue_tasks) / total,

                  upcoming_rate:
                    Number(project.upcoming_tasks) / total,

                  unassigned_rate:
                    Number(project.unassigned_tasks) / total,

                  workload_concentration:
                    Number(project.workload_concentration) / 100
                }),

                signal: AbortSignal.timeout(3000)
              }
            );

            if (!response.ok) {
              throw new Error('ML service unavailable');
            }

            const prediction =
              await response.json() as MLPrediction;

            return {
              ...project,
              ml_prediction: prediction.predicted_risk,
              ml_confidence: prediction.confidence,
              ml_probabilities: prediction.probabilities,
              ml_model: prediction.model,
              ml_training_data: prediction.training_data
            };
          } catch (error) {
            console.error(
              `ML prediction unavailable for ${project.name}:`,
              error
            );

            return {
              ...project,
              ml_prediction: null,
              ml_confidence: null,
              ml_probabilities: null,
              ml_model: null,
              ml_training_data: null
            };
          }
        })
      );

      // STEP 4: Automatically save project risk history
      // One record per project per day.
      // Refreshing updates today's record.
      await Promise.all(
        insightsWithML.map(async project => {
          try {
            await pool.query(
              `INSERT INTO project_risk_history (
                project_id,
                health_score,
                risk_level,
                ml_prediction,
                ml_confidence,
                completion_percentage
              )
              VALUES ($1, $2, $3, $4, $5, $6)

              ON CONFLICT (project_id, recorded_date)
              DO UPDATE SET
                health_score = EXCLUDED.health_score,
                risk_level = EXCLUDED.risk_level,
                ml_prediction = EXCLUDED.ml_prediction,
                ml_confidence = EXCLUDED.ml_confidence,
                completion_percentage =
                  EXCLUDED.completion_percentage,
                recorded_at = NOW()`,
              [
                project.id,
                project.health_score,
                project.risk_level,
                project.ml_prediction,
                project.ml_confidence,
                project.completion_percentage
              ]
            );
          } catch (error) {
            console.error(`History save error for ${project.name}:`, error);
            throw error;
          }
        })
      );

  return insightsWithML;
}

// Internal backend-only entry point; not an HTTP endpoint.
export async function runDailyRiskAssessment(pool: pg.Pool): Promise<void> {
  const projects = await calculateProjectInsights(pool, null);
  console.log(`Daily risk assessment saved for ${projects.length} project(s)`);
}
