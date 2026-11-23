import { useEffect, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  Users,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

type Insight = {
  id: string;
  name: string;
  risk_level: 'Low' | 'Medium' | 'High';
  overdue_tasks: number;
  upcoming_tasks: number;
  unassigned_tasks: number;
};

type Alert = {
  id: string;
  project: string;
  message: string;
  level: 'High' | 'Medium';
  type: 'overdue' | 'upcoming' | 'unassigned';
  isRead: boolean;
};

type NotificationsProps = {
  onNotificationsChanged?: () => void;
};

export default function Notifications({
  onNotificationsChanged
}: NotificationsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadAlerts() {
    setLoading(true);
    setError('');

    try {
      const [insightsResponse, readsResponse] = await Promise.all([
        fetch('/api/insights', { credentials: 'include' }),
        fetch('/api/notifications/read', { credentials: 'include' })
      ]);

      if (!insightsResponse.ok || !readsResponse.ok) {
        throw new Error('Unable to load notifications');
      }

      const projects: Insight[] = await insightsResponse.json();
      const readKeys: string[] = await readsResponse.json();
      const readSet = new Set(readKeys);
      const newAlerts: Alert[] = [];

      projects.forEach(project => {
        if (project.overdue_tasks > 0) {
          const id = `${project.id}-overdue`;
          newAlerts.push({
            id,
            project: project.name,
            message: `${project.overdue_tasks} overdue task(s) require immediate attention.`,
            level: 'High',
            type: 'overdue',
            isRead: readSet.has(id)
          });
        }

        if (project.upcoming_tasks > 0) {
          const id = `${project.id}-upcoming`;
          newAlerts.push({
            id,
            project: project.name,
            message: `${project.upcoming_tasks} unfinished task(s) are due within 3 days.`,
            level: 'Medium',
            type: 'upcoming',
            isRead: readSet.has(id)
          });
        }

        if (project.unassigned_tasks > 0) {
          const id = `${project.id}-unassigned`;
          newAlerts.push({
            id,
            project: project.name,
            message: `${project.unassigned_tasks} unfinished task(s) need an assignee.`,
            level: 'Medium',
            type: 'unassigned',
            isRead: readSet.has(id)
          });
        }
      });

      setAlerts(newAlerts);
      onNotificationsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
    // Initial load is intentionally performed once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleRead(alert: Alert) {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        alert.isRead ? '/api/notifications/unread' : '/api/notifications/read',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationKey: alert.id })
        }
      );

      if (!response.ok) {
        throw new Error('Unable to update notification');
      }

      setAlerts(previous =>
        previous.map(item =>
          item.id === alert.id ? { ...item, isRead: !alert.isRead } : item
        )
      );
      onNotificationsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function markAllAsRead() {
    if (busy) return;
    const unreadAlerts = alerts.filter(alert => !alert.isRead);
    if (unreadAlerts.length === 0) return;

    setBusy(true);
    setError('');

    try {
      const results = await Promise.all(
        unreadAlerts.map(async alert => {
          try {
            const response = await fetch('/api/notifications/read', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationKey: alert.id })
            });
            return { id: alert.id, success: response.ok };
          } catch {
            return { id: alert.id, success: false };
          }
        })
      );

      const successfulIds = new Set(
        results.filter(result => result.success).map(result => result.id)
      );

      setAlerts(previous =>
        previous.map(alert =>
          successfulIds.has(alert.id) ? { ...alert, isRead: true } : alert
        )
      );

      // Refresh the parent badge after any successful updates,
      // even if other requests failed.
      if (successfulIds.size > 0) {
        onNotificationsChanged?.();
      }

      if (results.some(result => !result.success)) {
        setError('Some notifications could not be marked as read.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = alerts.filter(alert => !alert.isRead).length;

  return (
    <div className="notifications-page">
      <div className="projects-head">
        <div>
          <span className="eyebrow">PROJECT RISK MONITORING</span>
          <h1><Bell size={26} /> Notifications</h1>
          <p>Early warnings about project deadlines and team tasks.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => void loadAlerts()}
          disabled={loading || busy}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="message error" role="alert">{error}</div>
      )}

      {loading ? (
        <p>Loading notifications...</p>
      ) : alerts.length === 0 ? (
        <div className="work-panel">
          <CheckCircle2 size={28} color="green" />
          <h3>No active alerts</h3>
          <p>Your projects have no detected task warnings.</p>
        </div>
      ) : (
        <>
          <div className="work-panel">
            <h3>Active alerts: {alerts.length}</h3>
            <p>{unreadCount} unread notification(s)</p>
            <button
              className="btn btn-outline"
              onClick={() => void markAllAsRead()}
              disabled={busy || unreadCount === 0}
            >
              <CheckCircle2 size={16} /> Mark all as read
            </button>
          </div>

          <div className="project-grid">
            {alerts.map(alert => (
              <div
                className="work-panel"
                key={alert.id}
                style={{ opacity: alert.isRead ? 0.75 : 1 }}
              >
                <h3>
                  {alert.type === 'overdue' ? (
                    <AlertTriangle size={20} color="red" />
                  ) : alert.type === 'upcoming' ? (
                    <Clock size={20} color="orange" />
                  ) : (
                    <Users size={20} color="orange" />
                  )}{' '}
                  {alert.project}
                </h3>
                <p>
                  <strong>{alert.level} Priority</strong>
                  {' · '}
                  {alert.isRead ? 'Read' : 'Unread'}
                </p>
                <p>{alert.message}</p>
                <p className="helper-text">
                  {alert.type === 'overdue'
                    ? 'Review overdue tasks and update their deadlines or progress.'
                    : alert.type === 'upcoming'
                    ? 'Complete upcoming tasks before their deadlines.'
                    : 'Assign unfinished tasks to project team members.'}
                </p>
                <button
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => void toggleRead(alert)}
                >
                  <CheckCircle2 size={16} />
                  {alert.isRead ? 'Mark as unread' : 'Mark as read'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="helper-text">
        Notifications are generated from live project task data.
        Read status is saved to your account.
      </p>
    </div>
  );
}
