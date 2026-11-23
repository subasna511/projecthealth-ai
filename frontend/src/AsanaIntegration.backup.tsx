
import { useEffect, useState } from 'react';
import { Link2, RefreshCw, Unplug } from 'lucide-react';

type AsanaStatus = {
  connected: boolean;
  asana_user_name?: string | null;
};

export default function AsanaIntegration() {
  const [status, setStatus] = useState<AsanaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/asana/status', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Unable to check Asana connection');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Connection error'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function connectAsana() {
    window.location.href = '/api/asana/connect';
  }

  async function disconnectAsana() {
    if (!window.confirm('Disconnect your Asana account?')) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/asana/disconnect', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Unable to disconnect Asana');
      }

      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Disconnect failed'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <h1>Asana Integration</h1>
      <p>Connect your Asana account to ProjectHealth AI.</p>

      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2>Asana Account</h2>

        {loading ? (
          <p>Checking connection...</p>
        ) : (
          <>
            <p>
              <strong>Status:</strong>{' '}
              {status?.connected ? 'Connected' : 'Not Connected'}
            </p>

            {status?.connected && status.asana_user_name && (
              <p>
                <strong>Account:</strong> {status.asana_user_name}
              </p>
            )}

            {status?.connected ? (
              <button
                className="secondary"
                onClick={() => void disconnectAsana()}
                disabled={busy}
              >
                <Unplug size={16} /> Disconnect
              </button>
            ) : (
              <button onClick={connectAsana}>
                <Link2 size={16} /> Connect to Asana
              </button>
            )}
          </>
        )}

        {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}

        <div style={{ marginTop: '20px' }}>
          <button
            className="secondary"
            onClick={() => void loadStatus()}
            disabled={loading || busy}
          >
            <RefreshCw size={16} /> Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
}
