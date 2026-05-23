import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('focusboard_token');
    fetch(`${API_URL}/logs`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando Historial...</div>;

  return (
    <div className="list-view-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-board)', borderRadius: 'var(--radius-lg)' }}>
        <Activity color="var(--accent-secondary)" />
        <h2 style={{ margin: 0 }}>Historial de Actividad</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {logs.length === 0 ? (
          <p className="text-muted text-center">No hay actividad reciente.</p>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ background: 'var(--bg-board)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-secondary)' }}>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>{log.action}</p>
              <small className="text-muted">{new Date(log.timestamp).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
