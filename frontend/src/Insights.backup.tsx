import RiskHistory from './RiskHistory';
import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Users,
  ListTodo,
  TrendingUp
} from 'lucide-react';

type RiskLevel = 'Low' | 'Medium' | 'High';

type Insight = {
  id: string;
  name: string;
  due_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  upcoming_tasks: number;
  unassigned_tasks: number;
  in_progress_tasks: number;
  unfinished_tasks: number;
  team_members: number;
  active_assignees: number;
  health_score: number;
  risk_level: RiskLevel;
  completion_percentage: number;
  workload_imbalance: boolean;
  workload_concentration: number;
  days_until_deadline: number | null;
  early_warning: boolean;
  risk_factors: string[];
  recommendations: string[];
  prediction_method: string;
  ml_prediction?: string | null;
  ml_confidence?: number | null;
  ml_probabilities?: Record<string, number> | null;
  ml_model?: string | null;
  ml_training_data?: string | null;
};

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadInsights() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/insights', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Unable to load project insights');
      }

      const data: Insight[] = await response.json();
      setInsights(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Request failed'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInsights();
  }, []);

  const averageHealth = insights.length
    ? Math.round(
        insights.reduce(
          (sum, project) => sum + project.health_score,
          0
        ) / insights.length
      )
    : 0;

  const highRiskCount = insights.filter(
    project => project.risk_level === 'High'
  ).length;

  const warningCount = insights.filter(
    project => project.early_warning
  ).length;

  const mlAvailableCount = insights.filter(
    project => project.ml_prediction != null
  ).length;

  return (
    <div className="insights-page">
      <div className="projects-head">
        <div>
          <span className="eyebrow">
            PHASE 4 · ML RISK MONITORING
          </span>

          <h1>
            <BrainCircuit size={26} /> AI Insights
          </h1>

          <p>
            Monitor project health, detect early warning signs,
            and review machine-learning risk predictions.
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={() => void loadInsights()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading project insights...</p>
      ) : insights.length === 0 ? (
        <div className="work-panel">
          <p>No projects found. Create a project first.</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW STATISTICS */}

          <div className="project-grid">
            <div className="work-panel">
              <h3>
                <ListTodo size={19} /> Total Projects
              </h3>
              <h2>{insights.length}</h2>
              <p className="helper-text">
                Projects being monitored
              </p>
            </div>

            <div className="work-panel">
              <h3>
                <TrendingUp size={19} /> Average Health
              </h3>
              <h2>{averageHealth}/100</h2>
              <p className="helper-text">
                Average rule-based health score
              </p>
            </div>

            <div className="work-panel">
              <h3>
                <AlertTriangle size={19} /> High Risk
              </h3>
              <h2>{highRiskCount}</h2>
              <p className="helper-text">
                Projects requiring attention
              </p>
            </div>

            <div className="work-panel">
              <h3>
                <Clock size={19} /> Early Warnings
              </h3>
              <h2>{warningCount}</h2>
              <p className="helper-text">
                Projects with detected warning signs
              </p>
            </div>
          </div>

          <div className="work-panel">
            <h3>
              <BrainCircuit size={19} />
              {' '}Machine Learning Status
            </h3>

            <p>
              ML predictions available for{' '}
              <strong>
                {mlAvailableCount} of {insights.length}
              </strong>
              {' '}projects.
            </p>

            <p className="helper-text">
              Predictions use an experimental Random Forest
              model trained on synthetic project data.
            </p>
          </div>

          <h2>Project Risk Analysis</h2>

          <div className="project-grid">
            {insights.map(project => (
              <div className="work-panel" key={project.id}>

                {/* PROJECT NAME */}

                <h3>
                  <BrainCircuit size={19} />
                  {' '}{project.name}
                </h3>

                {/* HEALTH SCORE */}

                <h2>{project.health_score}/100</h2>
                <p>Project Health Score</p>

                <progress
                  value={project.health_score}
                  max={100}
                  style={{ width: '100%' }}
                  aria-label={`${project.name} health score`}
                />

                {/* RULE-BASED RISK */}

                <p>
                  {project.risk_level === 'Low' ? (
                    <CheckCircle2 size={17} color="green" />
                  ) : (
                    <AlertTriangle size={17} color="orange" />
                  )}

                  {' '}Rule-Based Risk:{' '}
                  <strong>{project.risk_level}</strong>
                </p>

                {/* MACHINE LEARNING PREDICTION */}

                <div className="risk-recommendations">
                  <h4>
                    <BrainCircuit size={17} />
                    {' '}ML Risk Prediction
                  </h4>

                  {project.ml_prediction != null ? (
                    <>
                      <p>
                        Predicted Risk:{' '}
                        <strong>
                          {project.ml_prediction}
                        </strong>
                      </p>

                      <p>
                        Model Confidence:{' '}
                        <strong>
                          {project.ml_confidence ?? 'N/A'}
                          {project.ml_confidence != null ? '%' : ''}
                        </strong>
                      </p>

                      <p>
                        Model:{' '}
                        {project.ml_model ?? 'Random Forest'}
                      </p>

                      {project.ml_probabilities && (
                        <>
                          <h4>Prediction Breakdown</h4>

                          {(['Low', 'Medium', 'High'] as const)
                            .map(level => {
                              const probability =
                                project.ml_probabilities?.[level];

                              if (probability == null) {
                                return null;
                              }

                              return (
                                <div key={level}>
                                  <p>
                                    {level}: {probability}%
                                  </p>

                                  <progress
                                    value={probability}
                                    max={100}
                                    style={{ width: '100%' }}
                                    aria-label={`${level} model probability`}
                                  />
                                </div>
                              );
                            })}
                        </>
                      )}

                      <p className="helper-text">
                        Experimental prediction based on
                        synthetic training data. Model confidence
                        is not a validated real-world risk probability.
                      </p>
                    </>
                  ) : (
                    <p className="helper-text">
                      ML prediction unavailable.
                      Check that the Python ML service is running.
                      Rule-based monitoring remains active.
                    </p>
                  )}
                </div>
                {/* PROJECT RISK HISTORY */}
                 <RiskHistory projectId={project.id} />

                {/* EARLY WARNING */}

                {project.early_warning && (
                  <div className="message error">
                    <AlertTriangle size={17} />
                    {' '}Early warning detected
                  </div>
                )}

                {/* TASK ANALYSIS */}

                <h4>Task Analysis</h4>

                <div className="task-tags">
                  <span>Total: {project.total_tasks}</span>
                  <span>Completed: {project.completed_tasks}</span>
                  <span>In Progress: {project.in_progress_tasks}</span>
                  <span>Overdue: {project.overdue_tasks}</span>
                  <span>Upcoming: {project.upcoming_tasks}</span>
                  <span>Unassigned: {project.unassigned_tasks}</span>
                </div>

                <p>
                  Task completion:{' '}
                  <strong>
                    {project.completion_percentage}%
                  </strong>
                </p>

                <progress
                  value={project.completion_percentage}
                  max={100}
                  style={{ width: '100%' }}
                  aria-label={`${project.name} task completion`}
                />

                {/* PROJECT DEADLINE */}

                <h4>
                  <Clock size={17} /> Project Deadline
                </h4>

                <p>
                  {project.days_until_deadline === null
                    ? 'No project deadline set'
                    : project.days_until_deadline < 0
                    ? `Deadline passed ${Math.abs(
                        project.days_until_deadline
                      )} day(s) ago`
                    : `${project.days_until_deadline} day(s) remaining`}
                </p>

                {/* TEAM WORKLOAD */}

                <h4>
                  <Users size={17} /> Team Workload
                </h4>

                <p>
                  Team members: {project.team_members}
                </p>

                <p>
                  Members with assigned unfinished tasks:{' '}
                  {project.active_assignees}
                </p>

                <p>
                  Busiest member's share of assigned
                  unfinished tasks:{' '}
                  <strong>
                    {project.workload_concentration}%
                  </strong>
                </p>

                <p>
                  Workload imbalance:{' '}
                  <strong>
                    {project.workload_imbalance
                      ? 'Detected'
                      : 'Not detected'}
                  </strong>
                </p>

                {/* RISK FACTORS */}

                <div className="risk-recommendations">
                  <h4>
                    <AlertTriangle size={17} /> Risk Factors
                  </h4>

                  {(project.risk_factors ?? []).length > 0 ? (
                    <ul>
                      {project.risk_factors.map(
                        (factor, index) => (
                          <li key={index}>{factor}</li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p>No major risk factors detected.</p>
                  )}
                </div>

                {/* RECOMMENDATIONS */}

                <div className="risk-recommendations">
                  <h4>
                    <CheckCircle2 size={17} />
                    {' '}Recommendations
                  </h4>

                  <ul>
                    {(project.recommendations ?? []).map(
                      (recommendation, index) => (
                        <li key={index}>
                          {recommendation}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="helper-text">
        ProjectHealth AI combines explainable rule-based
        health monitoring with experimental machine-learning
        risk predictions. The Random Forest model is trained
        on synthetic data and has not been validated using
        real student project outcomes.
      </p>
    </div>
  );
}
