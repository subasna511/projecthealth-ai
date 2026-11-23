import RiskHistory from './RiskHistory';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BrainCircuit, AlertTriangle, CheckCircle2, RefreshCw, Clock,
  Users, ListTodo, TrendingUp, ArrowLeft, ChevronRight
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

const riskColors: Record<RiskLevel, string> = {
  Low: '#21865a', Medium: '#ad7815', High: '#c94a4a'
};
const cardStyle: CSSProperties = {
  border: '1px solid var(--border, #d8dde5)',
  borderRadius: 14, padding: 20, minWidth: 0
};
const statStyle: CSSProperties = {
  ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8
};
const smallGrid: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 14
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={statStyle}>
    <span className="helper-text">{label}</span>
    <strong style={{ fontSize: 24 }}>{value}</strong>
  </div>;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span style={{
    color: riskColors[risk], border: `1px solid ${riskColors[risk]}`,
    borderRadius: 999, padding: '5px 10px', fontWeight: 700,
    fontSize: 12, whiteSpace: 'nowrap'
  }}>{risk} Risk</span>;
}

function Detail({ project, onBack }: { project: Insight; onBack: () => void }) {
  return <>
    <button className="btn btn-outline" onClick={onBack} style={{ marginBottom: 20 }}>
      <ArrowLeft size={16} /> Back to AI Insights
    </button>
    <div className="projects-head">
      <div>
        <span className="eyebrow">PROJECT RISK ANALYSIS</span>
        <h1><BrainCircuit size={26} /> {project.name}</h1>
        <p>Complete project health and machine-learning risk assessment.</p>
      </div>
      <RiskBadge risk={project.risk_level} />
    </div>

    <div style={{ ...smallGrid, marginBottom: 20 }}>
      <Metric label="Project Health Score" value={`${project.health_score}/100`} />
      <Metric label="Rule-Based Risk" value={project.risk_level} />
      <Metric label="ML Risk Prediction" value={project.ml_prediction ?? 'Unavailable'} />
      <Metric label="ML Confidence" value={project.ml_confidence == null ? 'N/A' : `${project.ml_confidence}%`} />
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><TrendingUp size={19} /> Project Health Score</h3>
      <progress value={project.health_score} max={100} style={{ width: '100%' }} aria-label={`${project.name} health score`} />
      <p>Rule-Based Risk: <strong>{project.risk_level}</strong></p>
      {project.early_warning && <div className="message error"><AlertTriangle size={17} /> Early warning detected</div>}
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><BrainCircuit size={19} /> ML Risk Prediction</h3>
      {project.ml_prediction != null ? <>
        <p>Predicted Risk: <strong>{project.ml_prediction}</strong></p>
        <p>Model Confidence: <strong>{project.ml_confidence == null ? 'N/A' : `${project.ml_confidence}%`}</strong></p>
        <p>Model: {project.ml_model ?? 'Random Forest'}</p>
        {project.ml_probabilities && <>
          <h4>Prediction Breakdown</h4>
          {(['Low', 'Medium', 'High'] as const).map(level => {
            const probability = project.ml_probabilities?.[level];
            return probability == null ? null : <div key={level} style={{ marginBottom: 12 }}>
              <p>{level}: {probability}%</p>
              <progress value={probability} max={100} style={{ width: '100%' }} aria-label={`${level} model probability`} />
            </div>;
          })}
        </>}
        <p className="helper-text">Experimental prediction based on synthetic training data. Model confidence is not a validated real-world risk probability.</p>
      </> : <p className="helper-text">ML prediction unavailable. Check that the Python ML service is running. Rule-based monitoring remains active.</p>}
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <RiskHistory projectId={project.id} />
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><ListTodo size={19} /> Task Analysis</h3>
      <div style={smallGrid}>
        <Metric label="Total" value={project.total_tasks} />
        <Metric label="Completed" value={project.completed_tasks} />
        <Metric label="In Progress" value={project.in_progress_tasks} />
        <Metric label="Overdue" value={project.overdue_tasks} />
        <Metric label="Upcoming" value={project.upcoming_tasks} />
        <Metric label="Unassigned" value={project.unassigned_tasks} />
      </div>
      <p>Task completion: <strong>{project.completion_percentage}%</strong></p>
      <progress value={project.completion_percentage} max={100} style={{ width: '100%' }} aria-label={`${project.name} task completion`} />
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><Clock size={19} /> Project Deadline</h3>
      <p>{project.days_until_deadline === null ? 'No project deadline set' :
        project.days_until_deadline < 0 ? `Deadline passed ${Math.abs(project.days_until_deadline)} day(s) ago` :
        `${project.days_until_deadline} day(s) remaining`}</p>
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><Users size={19} /> Team Workload</h3>
      <p>Team members: {project.team_members}</p>
      <p>Members with assigned unfinished tasks: {project.active_assignees}</p>
      <p>Busiest member's share of assigned unfinished tasks: <strong>{project.workload_concentration}%</strong></p>
      <p>Workload imbalance: <strong>{project.workload_imbalance ? 'Detected' : 'Not detected'}</strong></p>
    </div>

    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><AlertTriangle size={19} /> Risk Factors</h3>
      {(project.risk_factors ?? []).length > 0 ? <ul>{project.risk_factors.map((factor, i) => <li key={i}>{factor}</li>)}</ul> : <p>No major risk factors detected.</p>}
    </div>
    <div className="work-panel" style={{ marginBottom: 20 }}>
      <h3><CheckCircle2 size={19} /> Recommendations</h3>
      {(project.recommendations ?? []).length > 0 ? <ul>{project.recommendations.map((recommendation, i) => <li key={i}>{recommendation}</li>)}</ul> : <p>No recommendations available.</p>}
    </div>
  </>;
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadInsights() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/insights', { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load project insights');
      const data: Insight[] = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadInsights(); }, []);

  const selectedProject = insights.find(project => project.id === selectedId);
  const averageHealth = insights.length ? Math.round(insights.reduce((sum, p) => sum + p.health_score, 0) / insights.length) : 0;
  const highRiskCount = insights.filter(p => p.risk_level === 'High').length;
  const warningCount = insights.filter(p => p.early_warning).length;
  const mlAvailableCount = insights.filter(p => p.ml_prediction != null).length;

  return <div className="insights-page">
    {error && <div className="message error" role="alert">{error}</div>}
    {loading ? <p>Loading project insights...</p> : selectedProject ?
      <Detail project={selectedProject} onBack={() => setSelectedId(null)} /> : <>
      <div className="projects-head">
        <div>
          <span className="eyebrow">PHASE 4 · ML RISK MONITORING</span>
          <h1><BrainCircuit size={26} /> AI Insights</h1>
          <p>Monitor project health, detect early warning signs, and review machine-learning risk predictions.</p>
        </div>
        <button className="btn btn-outline" onClick={() => void loadInsights()} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {insights.length === 0 ? <div className="work-panel"><p>No projects found. Create a project first.</p></div> : <>
        <div style={{ ...smallGrid, marginBottom: 20 }}>
          <Metric label="Total Projects" value={insights.length} />
          <Metric label="Average Health" value={`${averageHealth}/100`} />
          <Metric label="High Risk" value={highRiskCount} />
          <Metric label="Early Warnings" value={warningCount} />
        </div>
        <div className="work-panel" style={{ marginBottom: 24 }}>
          <h3><BrainCircuit size={19} /> Machine Learning Status</h3>
          <p>ML predictions available for <strong>{mlAvailableCount} of {insights.length}</strong> projects.</p>
          <p className="helper-text">Predictions use an experimental Random Forest model trained on synthetic project data.</p>
        </div>
        <h2>Project Risk Analysis</h2>
        <p className="helper-text">Select a project to view its full AI risk assessment.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 16 }}>
          {insights.map(project => <button key={project.id} type="button"
            onClick={() => setSelectedId(project.id)}
            aria-label={`View full analysis for ${project.name}`}
            style={{ ...cardStyle, display: 'block', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--panel, transparent)', color: 'inherit', font: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
              <strong style={{ overflowWrap: 'anywhere' }}>{project.name}</strong>
              <RiskBadge risk={project.risk_level} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{project.health_score}<span style={{ fontSize: 14, opacity: 0.7 }}>/100</span></div>
            <p className="helper-text">Project Health Score · {project.total_tasks} tasks</p>
            <progress value={project.health_score} max={100} style={{ width: '100%' }} aria-label={`${project.name} health score`} />
            {project.early_warning && <p style={{ color: riskColors.High, fontSize: 13 }}><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> Early warning detected</p>}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
              View Full Analysis <ChevronRight size={17} />
            </div>
          </button>)}
        </div>
      </>}
    </>}
    <p className="helper-text" style={{ marginTop: 24 }}>
      ProjectHealth AI combines explainable rule-based health monitoring with experimental machine-learning risk predictions. The Random Forest model is trained on synthetic data and has not been validated using real student project outcomes.
    </p>
  </div>;
}
