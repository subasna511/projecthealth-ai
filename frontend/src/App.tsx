
import { useEffect, useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate
} from 'react-router-dom';

import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CheckCircle2,
  FolderKanban,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Link2
} from 'lucide-react';

import Projects from './Projects';
import Insights from './Insights';
import Notifications from './Notifications';
import AsanaIntegration from './AsanaIntegration';

// ---------------- TYPES ----------------

type User = {
  id: string;
  name: string;
  email: string;
};

type Insight = {
  id: string;
  name: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  upcoming_tasks: number;
  unassigned_tasks: number;
  health_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
};

// ---------------- API ----------------

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
}

const post = <T,>(path: string, body: unknown) =>
  api<T>(path, {
    method: 'POST',
    body: JSON.stringify(body)
  });

// ---------------- LOGO ----------------

function Logo() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Activity size={21} />
      </span>

      <span>
        ProjectHealth <b>AI</b>
      </span>
    </Link>
  );
}

// ---------------- HOME PAGE ----------------

function Home() {
  return (
    <>
      <header className="topbar">
        <Logo />

        <nav>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>

          <Link to="/login" className="nav-login">
            Log in
          </Link>

          <Link to="/register" className="btn btn-dark">
            Get started <ArrowRight size={16} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={15} />
              THE SMARTER WAY TO MANAGE PROJECT RISK
            </span>

            <h1>
              See project risks <em>before</em> they become problems.
            </h1>

            <p>
              Turn your team's project data into clear health scores,
              early warnings, and practical next steps — all in one workspace.
            </p>

            <div className="actions">
              <Link className="btn btn-primary" to="/register">
                Start for free <ArrowRight size={18} />
              </Link>

              <a className="btn btn-outline" href="#features">
                Explore features
              </a>
            </div>

            <div className="trust">
              <ShieldCheck size={17} />
              Built for transparent, actionable project monitoring
            </div>
          </div>

          <div className="hero-visual">
            <div className="mock-window">
              <div className="mock-head">
                <span className="dots">● ● ●</span>
                <span>Project overview</span>
                <span>•••</span>
              </div>

              <div className="mock-body">
                <div className="mock-title">
                  Good morning, team <span>✦</span>
                </div>

                <div className="mock-sub">
                  Your project portfolio at a glance
                </div>

                <div className="metrics">
                  <div>
                    <small>Projects monitored</small>
                    <strong>08</strong>
                    <span>Across 3 teams</span>
                  </div>

                  <div>
                    <small>Average health</small>
                    <strong>
                      76<span className="unit">/100</span>
                    </strong>
                    <span className="green">● On track</span>
                  </div>

                  <div>
                    <small>Needs attention</small>
                    <strong>02</strong>
                    <span className="amber">● Review suggested</span>
                  </div>
                </div>

                <div className="mock-row">
                  <span>Website redesign</span>
                  <span className="pill good">Healthy · 87</span>
                </div>

                <div className="mock-row">
                  <span>Mobile app launch</span>
                  <span className="pill warn">At risk · 56</span>
                </div>

                <div className="mock-row">
                  <span>Capstone delivery</span>
                  <span className="pill good">Healthy · 82</span>
                </div>

                <div className="mock-insight">
                  <Sparkles size={17} />

                  <div>
                    <b>AI insight preview</b>
                    <p>
                      Review 2 overdue tasks to improve your delivery outlook.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <span className="preview-label">
              Illustrative dashboard preview — not live project data
            </span>
          </div>
        </section>

        <section id="features" className="section">
          <div className="section-heading">
            <span className="eyebrow">
              WHY PROJECTHEALTH AI
            </span>

            <h2>Go beyond task tracking.</h2>

            <p>
              Manage work today and prepare for tomorrow's risks.
            </p>
          </div>

          <div className="feature-grid">
            {[
              {
                Icon: HeartPulse,
                title: 'Project health scoring',
                desc: 'Understand overall project health with explainable risk indicators.'
              },
              {
                Icon: BrainCircuit,
                title: 'AI-powered insights',
                desc: 'Turn warning signs into practical recommendations.'
              },
              {
                Icon: Bell,
                title: 'Proactive alerts',
                desc: 'Stay ahead of upcoming deadlines and emerging risks.'
              },
              {
                Icon: FolderKanban,
                title: 'Asana integration',
                desc: 'Bring your existing projects into one monitoring workspace.'
              },
              {
                Icon: BarChart3,
                title: 'Clear reporting',
                desc: 'See progress, activity and health trends at a glance.'
              },
              {
                Icon: Users,
                title: 'Team collaboration',
                desc: 'Improve visibility and accountability across your team.'
              }
            ].map(({ Icon, title, desc }) => (
              <article className="feature" key={title}>
                <span className="feature-icon">
                  <Icon size={23} />
                </span>

                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="cta">
          <span className="eyebrow">GET STARTED</span>

          <h2>Build healthier projects, together.</h2>

          <p>
            Create your account to explore the new ProjectHealth AI workspace.
          </p>

          <Link className="btn btn-primary" to="/register">
            Create your account <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer>
        © {new Date().getFullYear()} ProjectHealth AI · Capstone project prototype
      </footer>
    </>
  );
}

// ---------------- LOGIN AND REGISTRATION ----------------

function Auth({
  mode,
  onLogin
}: {
  mode: 'login' | 'register';
  onLogin: (user: User) => void;
}) {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [step, setStep] = useState<'credentials' | 'otp'>(
    'credentials'
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'register') {
        await post('/auth/register', {
          name,
          email,
          password
        });

        navigate('/login');
      } else if (step === 'credentials') {
        await post('/auth/login', {
          email,
          password
        });

        setStep('otp');
        setInfo(
          'A six-digit verification code has been sent to your inbox.'
        );
      } else {
        const data = await post<{ user: User }>(
          '/auth/verify',
          { email, code }
        );

        onLogin(data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Logo />

        <Link to="/" className="back-link">
          ← Back to home
        </Link>
      </div>

      <div className="auth-layout">
        <div className="auth-side">
          <span className="eyebrow">
            WELCOME TO PROJECTHEALTH AI
          </span>

          <h1>
            Better visibility.
            <br />
            <em>Better outcomes.</em>
          </h1>

          <p>
            Monitor project health, stay ahead of risks,
            and keep your team moving forward.
          </p>

          <div className="auth-points">
            <span>
              <CheckCircle2 /> Clear project insights
            </span>

            <span>
              <CheckCircle2 /> Secure team workspace
            </span>

            <span>
              <CheckCircle2 /> Actionable risk monitoring
            </span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-symbol">
            <LockKeyhole size={24} />
          </div>

          <h2>
            {step === 'otp'
              ? 'Verify your email'
              : mode === 'register'
              ? 'Create your account'
              : 'Welcome back'}
          </h2>

          <p>
            {step === 'otp'
              ? `Enter the six-digit code sent to ${email}`
              : mode === 'register'
              ? 'Get started with your ProjectHealth AI workspace.'
              : 'Sign in to access your project dashboard.'}
          </p>

          <form onSubmit={submit}>
            {step === 'credentials' ? (
              <>
                {mode === 'register' && (
                  <label>
                    Full name

                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </label>
                )}

                <label>
                  Email address

                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                <label>
                  Password

                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete={
                      mode === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                  />
                </label>
              </>
            ) : (
              <label>
                Verification code

                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={e =>
                    setCode(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </label>
            )}

            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}

            {info && (
              <div className="message success" role="status">
                {info}
              </div>
            )}

            <button
              className="btn btn-primary full"
              disabled={busy}
            >
              {busy
                ? 'Please wait...'
                : step === 'otp'
                ? 'Verify and continue'
                : mode === 'register'
                ? 'Create account'
                : 'Continue with email'}

              <ArrowRight size={17} />
            </button>
          </form>

          {step === 'otp' ? (
            <button
              className="text-button"
              onClick={() => {
                setStep('credentials');
                setCode('');
                setInfo('');
                setError('');
              }}
            >
              Back to login / request a new code
            </button>
          ) : (
            <div className="switch">
              {mode === 'register'
                ? 'Already have an account?'
                : 'New to ProjectHealth AI?'}

              {' '}

              <Link
                to={
                  mode === 'register'
                    ? '/login'
                    : '/register'
                }
              >
                {mode === 'register'
                  ? 'Log in'
                  : 'Create an account'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- DASHBOARD ----------------

const sections = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Projects', icon: FolderKanban },
  { name: 'AI Insights', icon: BrainCircuit },
  { name: 'Notifications', icon: Bell },
  { name: 'Asana Integration', icon: Link2 }
];

function Dashboard({
  user,
  onLogout
}: {
  user: User;
  onLogout: () => void;
}) {
  const [section, setSection] = useState('Overview');
  const [projectCount, setProjectCount] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [insightsError, setInsightsError] = useState('');
  const [menu, setMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [projects, projectInsights, readKeys] = await Promise.all([
          api<{ id: string }[]>('/projects'),
          api<Insight[]>('/insights'),
          api<string[]>('/notifications/read')
        ]);

        if (active) {
          setProjectCount(projects.length);
          setInsights(projectInsights);
          const activeKeys = projectInsights.flatMap(project => [
  ...(project.overdue_tasks > 0 ? [`${project.id}-overdue`] : []),
  ...(project.upcoming_tasks > 0 ? [`${project.id}-upcoming`] : []),
  ...(project.unassigned_tasks > 0 ? [`${project.id}-unassigned`] : [])
]);

setUnreadCount(
  activeKeys.filter(key => !readKeys.includes(key)).length
);
          setInsightsError('');
        }
      } catch (err) {
        if (active) {
          setInsightsError(
            err instanceof Error
              ? err.message
              : 'Unable to load dashboard'
          );
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [section, refreshKey]);

  const averageHealth = insights.length
    ? Math.round(
        insights.reduce(
          (sum, project) => sum + project.health_score,
          0
        ) / insights.length
      )
    : null;

  const projectsAtRisk = insights.filter(
    project =>
      project.risk_level === 'High' ||
      project.risk_level === 'Medium'
  ).length;

  const overdueTasks = insights.reduce(
    (sum, project) => sum + project.overdue_tasks,
    0
  );


  return (
    <div className="app-shell">
      <aside className={menu ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-logo">
          <Logo />

          <button
            className="mobile-close"
            onClick={() => setMenu(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        <div className="sidebar-label">
          WORKSPACE
        </div>

        <div className="side-nav">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={section === name ? 'active' : ''}
              onClick={() => {
                setSection(name);
                setMenu(false);
              }}
            >
             
<Icon size={19} />
{name}

{name === 'Notifications' && unreadCount > 0 && (
  <span className="soon">{unreadCount}</span>
)}
</button>

          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar">
              {user.name.charAt(0).toUpperCase()}
            </span>

            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>

          <button
            className="logout"
            onClick={onLogout}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dash-top">
          <button
            className="menu-toggle"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>

          <span>
            Workspace / {section}
          </span>

          <div className="avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="dash-content">
          {section === 'Overview' ? (
            <>
              <div className="dash-welcome">
                <div>
                  <span className="eyebrow">
                    YOUR WORKSPACE
                  </span>

                  <h1>
                    Welcome back, {user.name.split(' ')[0]}{' '}
                    <span>👋</span>
                  </h1>

                  <p>
                    Monitor your projects, performance,
                    and early warning signs.
                  </p>
                </div>

                <span className="phase-tag">
                  Phase 3 · Risk monitoring
                </span>
              </div>

              {insightsError && (
                <div className="message error" role="alert">
                  {insightsError}
                </div>
              )}

              <div className="dash-cards">
                <div className="stat-card">
                  <span className="stat-icon blue">
                    <FolderKanban size={21} />
                  </span>

                  <small>Total projects</small>

                  <strong>
                    {projectCount}
                  </strong>

                  <p>
                    Projects saved in your workspace.
                  </p>
                </div>

                <div className="stat-card">
                  <span className="stat-icon green-bg">
                    <HeartPulse size={21} />
                  </span>

                  <small>Average health score</small>

                  <strong>
                    {averageHealth === null
                      ? '—'
                      : `${averageHealth}/100`}
                  </strong>

                  <p>
                    Calculated from your project task data.
                  </p>
                </div>

                <div className="stat-card">
                  <span className="stat-icon orange">
                    <Bell size={21} />
                  </span>

                  <small>
                    Projects needing attention
                  </small>

                  <strong>
                    {projectsAtRisk}
                  </strong>

                  <p>
                    {overdueTasks} overdue tasks across your projects.
                  </p>
                </div>
              </div>

              <div className="dash-panels">
                <div className="panel">
                  <div className="panel-heading">
                    <h3>My projects</h3>
                    <span>Live data</span>
                  </div>

                  {insights.length === 0 ? (
                    <div className="empty-state">
                      <FolderKanban size={35} />

                      <h3>No projects yet</h3>

                      <p>
                        Open Projects to create and manage your projects.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {insights.map(project => (
                        <div
                          className="mock-row"
                          key={project.id}
                        >
                          <span>
                            {project.name}
                          </span>

                          <span
                            className={
                              project.risk_level === 'Low'
                                ? 'pill good'
                                : 'pill warn'
                            }
                          >
                            {project.risk_level} ·{' '}
                            {project.health_score}/100
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-heading">
                    <h3>
                      <Sparkles size={18} />
                      Risk insights
                    </h3>

                    <span>Rule-based</span>
                  </div>

                  {insights.length === 0 ? (
                    <div className="empty-state">
                      <BrainCircuit size={35} />

                      <h3>
                        Insights will appear here
                      </h3>

                      <p>
                        Create projects and tasks to start monitoring risks.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p>
                        <strong>
                          {projectsAtRisk}
                        </strong>{' '}
                        project(s) currently need attention.
                      </p>

                      <p>
                        <strong>
                          {overdueTasks}
                        </strong>{' '}
                        overdue task(s) detected.
                      </p>

                      <p>
                        Open AI Insights to review individual project
                        scores and recommendations.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : section === 'Projects' ? (
            <Projects onCount={setProjectCount} />
          ) : section === 'AI Insights' ? (
            <Insights />
          ) : section === 'Notifications' ? (
  <Notifications onNotificationsChanged={() => setRefreshKey(previous => previous + 1)} />
) : section === 'Asana Integration' ? (
  <AsanaIntegration onSyncComplete={() => setRefreshKey(previous => previous + 1)} />
) : null}
        </main>
      </div>
    </div>
  );
}

// ---------------- APP ROUTES ----------------

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then(data => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    try {
      await api('/auth/logout', {
        method: 'POST'
      });
    } finally {
      setUser(null);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <Activity />
        Loading ProjectHealth AI...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/register"
        element={
          user
            ? <Navigate to="/dashboard" />
            : (
              <Auth
                mode="register"
                onLogin={setUser}
              />
            )
        }
      />

      <Route
        path="/login"
        element={
          user
            ? <Navigate to="/dashboard" />
            : (
              <Auth
                mode="login"
                onLogin={setUser}
              />
            )
        }
      />

      <Route
        path="/dashboard"
        element={
          user
            ? (
              <Dashboard
                user={user}
                onLogout={logout}
              />
            )
            : <Navigate to="/login" />
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" />}
      />
    </Routes>
  );
}
