import { useEffect, useState } from 'react';
import {
  Link2, RefreshCw, Unplug, FolderKanban, Download, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, BrainCircuit, Clock3,
  ListTodo, Activity
} from 'lucide-react';

type AsanaStatus = {
  connected: boolean;
  account?: { asana_user_name?: string | null } | null;
};
type AsanaProject = {
  gid: string;
  name: string;
  workspace_gid?: string;
  workspace_name?: string;
  imported?: boolean;
  local_project_id?: string | null;
  last_synced_at?: string | null;
};
type ProjectInsight = {
  id: string;
  name: string;
  health_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  total_tasks: number;
  completed_tasks: number;
  ml_prediction?: string | null;
  ml_confidence?: number | null;
  recommendations?: string[];
};
type AsanaIntegrationProps = { onSyncComplete?: () => void };

async function readJson(response: Response): Promise<any> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}
function formatSyncDate(value?: string | null) {
  if (!value) return 'Never synced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short'
  });
}

export default function AsanaIntegration({ onSyncComplete }: AsanaIntegrationProps) {
  const [status, setStatus] = useState<AsanaStatus | null>(null);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [projectInsights, setProjectInsights] = useState<Record<string, ProjectInsight>>({});
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [insightsError, setInsightsError] = useState('');

  async function loadStatus() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/asana/status', { credentials: 'include' });
      const data = (await readJson(response)) as AsanaStatus;
      setStatus(data);
      if (!data.connected) {
        setProjects([]);
        setProjectInsights({});
        setProjectsLoaded(false);
        setExpandedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check Asana connection');
    } finally { setLoading(false); }
  }

  async function loadProjectInsights() {
    const response = await fetch('/api/insights', { credentials: 'include' });
    const data = (await readJson(response)) as ProjectInsight[];
    if (!Array.isArray(data)) throw new Error('Unexpected AI insights response');
    const byId: Record<string, ProjectInsight> = {};
    for (const insight of data) byId[insight.id] = insight;
    setProjectInsights(byId);
    setInsightsError('');
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/asana/projects', { credentials: 'include' });
      const data = await readJson(response);
      if (!Array.isArray(data.projects)) throw new Error('Unexpected Asana projects response');
      setProjects(data.projects as AsanaProject[]);
      setProjectsLoaded(true);
      try { await loadProjectInsights(); }
      catch (err) { setInsightsError(err instanceof Error ? err.message : 'Unable to load AI insights'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Asana projects');
    } finally { setProjectsLoading(false); }
  }

  useEffect(() => { void loadStatus(); }, []);

  function connectAsana() { window.location.href = '/api/asana/connect'; }

  async function disconnectAsana() {
    if (!window.confirm('Disconnect your Asana account?')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/asana/disconnect', {
        method: 'POST', credentials: 'include'
      });
      await readJson(response);
      setProjects([]); setProjectInsights({}); setProjectsLoaded(false);
      setExpandedId(null);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect Asana');
    } finally { setBusy(false); }
  }

  async function importProject(gid: string, name: string) {
    if (!window.confirm(`Import or sync "${name}" with ProjectHealth AI?`)) return;
    setImportingId(gid); setError(''); setSuccess('');
    try {
      const response = await fetch(`/api/asana/projects/${encodeURIComponent(gid)}/import`, {
        method: 'POST', credentials: 'include'
      });
      const data = await readJson(response);
      const warning = data.analysis_updated === false
        ? ' AI analysis could not be refreshed on the backend.' : '';
      // A successful import should remain successful even if the following UI refresh fails.
      setSuccess(`Successfully imported/synced "${name}". New tasks: ${data.created_tasks ?? 0}, updated tasks: ${data.updated_tasks ?? 0}.${warning}`);
      try { await loadProjects(); }
      catch { /* loadProjects already reports its own errors */ }
      onSyncComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project import or sync failed');
    } finally { setImportingId(null); }
  }

  const syncedCount = projects.filter(p => p.imported).length;
  const analyzedCount = projects.filter(p => p.local_project_id && projectInsights[p.local_project_id]).length;
  const highRiskCount = projects.filter(p => p.local_project_id && projectInsights[p.local_project_id]?.risk_level === 'High').length;
  const actionsDisabled = busy || importingId !== null;

  return (
    <div className="asana-redesign">
      <style>{`
        .asana-redesign { max-width: 1120px; margin: 0 auto; padding: 24px; color: inherit; }
        .asana-redesign * { box-sizing: border-box; }
        .asana-redesign .ar-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; }
        .asana-redesign .ar-title { display:flex; align-items:center; gap:10px; margin:0 0 8px; font-size:clamp(25px,3vw,32px); }
        .asana-redesign .ar-muted { color:var(--text-muted,#718096); font-size:14px; line-height:1.5; margin:0; }
        .asana-redesign .ar-panel { background:var(--card-bg,var(--surface,#fff)); border:1px solid var(--border-color,#e2e8f0); border-radius:16px; padding:22px; margin-bottom:20px; }
        .asana-redesign .ar-panel-title { display:flex; align-items:center; gap:9px; margin:0 0 8px; font-size:18px; }
        .asana-redesign .ar-row { display:flex; align-items:center; gap:12px; }
        .asana-redesign .ar-between { justify-content:space-between; }
        .asana-redesign .ar-wrap { flex-wrap:wrap; }
        .asana-redesign .ar-grow { flex:1; min-width:0; }
        .asana-redesign .ar-actions { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
        .asana-redesign button.ar-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:10px; padding:10px 14px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; background:#2563eb; color:white; border:1px solid #2563eb; }
        .asana-redesign button.ar-btn.ar-outline { background:transparent; color:inherit; border-color:var(--border-color,#cbd5e1); }
        .asana-redesign button.ar-btn:disabled { opacity:.55; cursor:not-allowed; }
        .asana-redesign .ar-icon { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:rgba(37,99,235,.09); color:#2563eb; flex-shrink:0; }
        .asana-redesign .ar-badge { display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:700; white-space:nowrap; }
        .asana-redesign .ar-green { color:#166534; background:#dcfce7; }
        .asana-redesign .ar-red { color:#991b1b; background:#fee2e2; }
        .asana-redesign .ar-amber { color:#92400e; background:#fef3c7; }
        .asana-redesign .ar-gray { color:#475569; background:#f1f5f9; }
        .asana-redesign .ar-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px; }
        .asana-redesign .ar-stat { border:1px solid var(--border-color,#e2e8f0); border-radius:14px; padding:18px; background:var(--card-bg,var(--surface,#fff)); }
        .asana-redesign .ar-stat strong { display:block; font-size:28px; margin:8px 0 4px; }
        .asana-redesign .ar-stat .ar-muted { font-size:12px; }
        .asana-redesign .ar-list { display:grid; gap:12px; margin-top:18px; }
        .asana-redesign .ar-project { border:1px solid var(--border-color,#e2e8f0); border-radius:13px; padding:17px; }
        .asana-redesign .ar-project-name { font-size:16px; font-weight:700; margin:0 0 5px; overflow-wrap:anywhere; }
        .asana-redesign .ar-meta { display:flex; flex-wrap:wrap; gap:7px 16px; margin:10px 0; font-size:13px; color:var(--text-muted,#718096); }
        .asana-redesign .ar-score { height:7px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin:12px 0; }
        .asana-redesign .ar-score span { display:block; height:100%; border-radius:999px; }
        .asana-redesign .ar-details { border-top:1px solid var(--border-color,#e2e8f0); margin-top:16px; padding-top:16px; }
        .asana-redesign .ar-details-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .asana-redesign .ar-detail-box { border-radius:10px; background:var(--surface-secondary,rgba(148,163,184,.08)); padding:13px; }
        .asana-redesign .ar-detail-box strong { display:block; margin-top:5px; }
        .asana-redesign .ar-details ul { padding-left:20px; margin:8px 0 0; }
        .asana-redesign .ar-details li { margin-bottom:7px; line-height:1.5; }
        .asana-redesign .ar-message { padding:13px 15px; border-radius:10px; margin:0 0 18px; font-size:14px; }
        .asana-redesign .ar-success { background:#dcfce7; color:#166534; }
        .asana-redesign .ar-error { background:#fee2e2; color:#991b1b; }
        .asana-redesign .ar-empty { text-align:center; padding:34px 12px; color:var(--text-muted,#718096); }
        @media(max-width:760px) { .asana-redesign {padding:14px;} .asana-redesign .ar-header {flex-direction:column;} .asana-redesign .ar-stats {grid-template-columns:repeat(2,minmax(0,1fr));} .asana-redesign .ar-details-grid {grid-template-columns:1fr;} .asana-redesign .ar-panel {padding:16px;} }
      `}</style>

      <div className="ar-header">
        <div>
          <h1 className="ar-title"><Link2 size={27} /> Asana Integration</h1>
          <p className="ar-muted">Connect your workspace, sync project tasks, and monitor AI-powered project health.</p>
        </div>
        <button className="ar-btn ar-outline" onClick={() => void loadStatus()} disabled={loading || actionsDisabled}>
          <RefreshCw size={16} /> {loading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      {success && <div role="status" className="ar-message ar-success">{success}</div>}
      {error && <div role="alert" className="ar-message ar-error">{error}</div>}

      <section className="ar-panel" aria-label="Asana account connection">
        <div className="ar-row ar-between ar-wrap">
          <div className="ar-row ar-grow">
            <div className="ar-icon"><Link2 size={23} /></div>
            <div className="ar-grow">
              <h2 className="ar-panel-title">Asana Account</h2>
              <p className="ar-muted">{loading ? 'Checking connection...' : status?.connected ? (status.account?.asana_user_name ? `Connected as ${status.account.asana_user_name}` : 'Your Asana workspace is connected') : 'Connect your account to import projects'}</p>
            </div>
          </div>
          <span className={`ar-badge ${status?.connected ? 'ar-green' : 'ar-gray'}`}>
            {status?.connected ? <CheckCircle2 size={14} /> : <Unplug size={14} />}
            {loading ? 'Checking' : status?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        {!loading && (
          <div className="ar-actions" style={{ marginTop:18 }}>
            {status?.connected ? (
              <button className="ar-btn ar-outline" onClick={() => void disconnectAsana()} disabled={actionsDisabled}>
                <Unplug size={16} /> {busy ? 'Disconnecting...' : 'Disconnect Asana'}
              </button>
            ) : (
              <button className="ar-btn" onClick={connectAsana} disabled={actionsDisabled}>
                <Link2 size={16} /> Connect to Asana
              </button>
            )}
          </div>
        )}
      </section>

      {status?.connected && (
        <>
          <div className="ar-stats" aria-label="Asana project overview">
            <div className="ar-stat"><FolderKanban size={20} /><strong>{projectsLoaded ? projects.length : '—'}</strong><p className="ar-muted">Asana Projects</p></div>
            <div className="ar-stat"><CheckCircle2 size={20} /><strong>{projectsLoaded ? syncedCount : '—'}</strong><p className="ar-muted">Synced Projects</p></div>
            <div className="ar-stat"><BrainCircuit size={20} /><strong>{projectsLoaded ? analyzedCount : '—'}</strong><p className="ar-muted">AI Assessments</p></div>
            <div className="ar-stat"><AlertTriangle size={20} /><strong>{projectsLoaded ? highRiskCount : '—'}</strong><p className="ar-muted">High-Risk Projects</p></div>
          </div>

          <section className="ar-panel" aria-label="Asana projects">
            <div className="ar-row ar-between ar-wrap">
              <div>
                <h2 className="ar-panel-title"><FolderKanban size={20} /> Asana Projects</h2>
                <p className="ar-muted">Import or update projects, then expand a card to review its AI assessment.</p>
              </div>
              <button className="ar-btn" onClick={() => void loadProjects()} disabled={projectsLoading || actionsDisabled}>
                <RefreshCw size={16} /> {projectsLoading ? 'Loading...' : projectsLoaded ? 'Refresh Projects' : 'View Asana Projects'}
              </button>
            </div>
            {insightsError && <div role="alert" className="ar-message ar-error" style={{marginTop:16}}>Projects loaded, but AI results are unavailable: {insightsError}</div>}

            {!projectsLoaded && !projectsLoading && (
              <div className="ar-empty"><FolderKanban size={30} style={{marginBottom:8}} /><p>Click “View Asana Projects” to load your workspace projects.</p></div>
            )}
            {projectsLoading && !projectsLoaded && <p className="ar-muted" style={{marginTop:18}}>Loading Asana projects...</p>}
            {projectsLoaded && projects.length === 0 && <div className="ar-empty">No Asana projects found in this account.</div>}
            {projects.length > 0 && (
              <div className="ar-list">
                {projects.map(project => {
                  const insight = project.local_project_id ? projectInsights[project.local_project_id] : undefined;
                  const expanded = expandedId === project.gid;
                  const riskClass = insight?.risk_level === 'High' ? 'ar-red' : insight?.risk_level === 'Medium' ? 'ar-amber' : 'ar-green';
                  const scoreColor = insight?.risk_level === 'High' ? '#dc2626' : insight?.risk_level === 'Medium' ? '#d97706' : '#16a34a';
                  return (
                    <article className="ar-project" key={project.gid}>
                      <div className="ar-row ar-between ar-wrap">
                        <div className="ar-grow">
                          <h3 className="ar-project-name">{project.name}</h3>
                          <p className="ar-muted">{project.workspace_name || 'Unknown workspace'}</p>
                        </div>
                        <div className="ar-actions">
                          <span className={`ar-badge ${project.imported ? 'ar-green' : 'ar-gray'}`}>{project.imported ? 'Synced' : 'Not imported'}</span>
                          {insight && <span className={`ar-badge ${riskClass}`}>{insight.risk_level} Risk</span>}
                        </div>
                      </div>
                      <div className="ar-meta">
                        <span><Clock3 size={13} style={{verticalAlign:'middle'}} /> {formatSyncDate(project.last_synced_at)}</span>
                        {insight && <span><ListTodo size={13} style={{verticalAlign:'middle'}} /> {insight.completed_tasks}/{insight.total_tasks} tasks completed</span>}
                        {insight && <span><Activity size={13} style={{verticalAlign:'middle'}} /> Health {insight.health_score}/100</span>}
                      </div>
                      {insight && (
                        <div className="ar-score" role="progressbar" aria-label={`${project.name} health score`} aria-valuenow={Math.max(0,Math.min(100,insight.health_score))} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{width:`${Math.max(0,Math.min(100,insight.health_score))}%`, background:scoreColor}} />
                        </div>
                      )}
                      <div className="ar-actions" style={{marginTop:12}}>
                        <button className="ar-btn" onClick={() => void importProject(project.gid,project.name)} disabled={importingId !== null || busy || projectsLoading}>
                          <Download size={16} /> {importingId === project.gid ? 'Processing...' : project.imported ? 'Sync Again' : 'Import Project'}
                        </button>
                        <button className="ar-btn ar-outline" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : project.gid)}>
                          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {expanded ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                      {expanded && (
                        <div className="ar-details">
                          <div className="ar-details-grid">
                            <div className="ar-detail-box"><span className="ar-muted">Asana Project ID</span><strong style={{overflowWrap:'anywhere'}}>{project.gid}</strong></div>
                            <div className="ar-detail-box"><span className="ar-muted">Last synchronized</span><strong>{formatSyncDate(project.last_synced_at)}</strong></div>
                            <div className="ar-detail-box"><span className="ar-muted">ML Risk Prediction</span><strong>{insight?.ml_prediction ?? 'Not available'}</strong></div>
                            <div className="ar-detail-box"><span className="ar-muted">ML Confidence</span><strong>{insight?.ml_confidence != null ? `${insight.ml_confidence}%` : 'Not available'}</strong></div>
                          </div>
                          {insight ? (
                            <div style={{marginTop:18}}>
                              <h4 style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 8px'}}><BrainCircuit size={17}/> AI Risk Summary</h4>
                              <p className="ar-muted">Health score: {insight.health_score}/100 · Rule-based risk: {insight.risk_level} · Completed tasks: {insight.completed_tasks}/{insight.total_tasks}</p>
                              <h4 style={{margin:'18px 0 8px'}}>Recommendations</h4>
                              {insight.recommendations?.length ? <ul>{insight.recommendations.map((recommendation,index)=><li key={index}>{recommendation}</li>)}</ul> : <p className="ar-muted">No recommendations available.</p>}
                              <p className="ar-muted" style={{marginTop:12}}>For full risk history, prediction breakdown, and team workload, open the AI Insights section.</p>
                            </div>
                          ) : (
                            <p className="ar-muted" style={{marginTop:14}}>No AI assessment available yet. Import or sync this project to generate an analysis.</p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <p className="ar-muted">AI risk predictions are experimental. For detailed analysis and risk history, use the AI Insights page.</p>
        </>
      )}
    </div>
  );
}
