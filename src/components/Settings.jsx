import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001/api';

export default function Settings({ onBgChange }) {
  const [apiKey, setApiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [unsplashKey, setUnsplashKey] = useState('');
  const [bgQuery, setBgQuery] = useState('');
  const [appName, setAppName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('focusboard_token');
    fetch(`${API_URL}/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setApiKey(data.apiKey || '');
        if (data.hasOpenaiKey) setOpenaiKey('********');
        if (data.hasUnsplashKey) setUnsplashKey('********');
      });
    
    fetch(`${API_URL}/board`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setAppName(data.appName || 'FocusBoard'));
  }, []);

  const saveKeys = async () => {
    setLoading(true);
    setMsg('');
    const token = localStorage.getItem('focusboard_token');
    try {
      // Si la llave es '********', significa que no ha cambiado y no debemos enviarla
      const payload = {};
      if (openaiKey && openaiKey !== '********') payload.openaiKey = openaiKey;
      if (unsplashKey && unsplashKey !== '********') payload.unsplashKey = unsplashKey;

      await fetch(`${API_URL}/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setMsg('Ajustes guardados correctamente.');
    } catch (err) {
      setMsg('Error guardando los ajustes.');
    }
    setLoading(false);
  };

  const saveAppName = async () => {
    if (!appName.trim()) return;
    setLoading(true);
    const token = localStorage.getItem('focusboard_token');
    try {
      // Necesitamos obtener las columnas actuales para no sobreescribir el estado,
      // esto es un hack rápido, idealmente lo maneja App.jsx
      const res = await fetch(`${API_URL}/board`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      
      await fetch(`${API_URL}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ columns: data.columns, columnOrder: data.columnOrder, bgImageUrl: data.bgImageUrl, appName })
      });
      setMsg('Nombre de la aplicación guardado. Recarga la página para ver los cambios.');
    } catch (err) {
      setMsg('Error guardando nombre.');
    }
    setLoading(false);
  };

  const changeBackground = async () => {
    if (!bgQuery) return;
    setLoading(true);
    setMsg('');
    const token = localStorage.getItem('focusboard_token');
    try {
      const res = await fetch(`${API_URL}/external/unsplash?query=${bgQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (onBgChange) onBgChange(`url(${data.url})`);
      setMsg('Fondo cambiado exitosamente.');
    } catch (err) {
      setMsg(`Error de Unsplash: ${err.message}. ¿Tienes tu API Key guardada?`);
    }
    setLoading(false);
  };

  return (
    <div className="settings-container">
      <h2>Ajustes</h2>
      
      {msg && <div className="login-error" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', borderColor: 'var(--accent-success)' }}>{msg}</div>}

      <div className="settings-card">
        <h3>Tu API Key Personal</h3>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Usa esta llave para crear tareas desde la terminal o tus propios scripts enviando un POST a <code>{API_URL}/tasks</code> con el header <code>x-api-key</code>.
        </p>
        <div className="api-key-box">
          <code>{apiKey || 'No disponible'}</code>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: '1rem' }}>
        <h3>Integraciones e Inteligencia Artificial</h3>
        
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">Google Gemini API Key</label>
          <input 
            type="password" 
            className="form-input" 
            placeholder="AIzaSy..." 
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
          />
          <small className="text-muted">Necesaria para usar la varita mágica y generar subtareas con Google Gemini.</small>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">Unsplash API Key (Access Key)</label>
          <input 
            type="password" 
            className="form-input" 
            value={unsplashKey}
            onChange={e => setUnsplashKey(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={saveKeys} disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Llaves API'}
        </button>
      </div>
      
      <div className="settings-card" style={{ marginTop: '1rem' }}>
        <h3>Personalización de tu Espacio</h3>
        
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">Nombre de tu Aplicación</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              style={{ flex: 1 }}
              value={appName}
              onChange={e => setAppName(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveAppName} disabled={loading}>Guardar Nombre</button>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">Buscar un nuevo fondo (Ej: "mountains", "hacker")</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              style={{ flex: 1 }}
              value={bgQuery}
              onChange={e => setBgQuery(e.target.value)}
            />
            <button className="btn btn-primary" onClick={changeBackground} disabled={loading}>Buscar y Aplicar</button>
          </div>
        </div>
      </div>

    </div>
  );
}
