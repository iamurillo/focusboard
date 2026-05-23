import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Tag, Plus, Trash2, CheckSquare, MessageSquare, Paperclip, UploadCloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

export default function TaskModal({ isOpen, onClose, onSave, task, onAutosuggest, token }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  
  // Markdown preview mode
  const [isPreview, setIsPreview] = useState(false);

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Time tracking
  const [timeSpent, setTimeSpent] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate || '');
      setTags(task.tags || []);
      setSubtasks(task.subtasks || []);
      setComments(task.comments || []);
      setAttachments(task.attachments || []);
      setTimeSpent(task.timeSpent || 0);
      setIsPreview(true); // default to preview if editing
      setIsTimerRunning(false);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setTags([]);
      setSubtasks([]);
      setComments([]);
      setAttachments([]);
      setTimeSpent(0);
      setIsPreview(false);
      setIsTimerRunning(false);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsTimerRunning(false); // Detener el temporizador si estaba corriendo
    onSave({ title, description, priority, dueDate, tags, subtasks, comments, attachments, timeSpent });
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddSubtask = (e) => {
    if (e.key === 'Enter' && subtaskInput.trim()) {
      e.preventDefault();
      setSubtasks([...subtasks, { id: uuidv4(), title: subtaskInput.trim(), completed: false }]);
      setSubtaskInput('');
    }
  };

  const toggleSubtask = (id) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  };

  const removeSubtask = (id) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const handleAddComment = (e) => {
    if (e.key === 'Enter' && commentInput.trim()) {
      e.preventDefault();
      setComments([...comments, { id: uuidv4(), text: commentInput.trim(), date: new Date().toISOString() }]);
      setCommentInput('');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAttachments([...attachments, { id: uuidv4(), url: data.url, name: data.name }]);
    } catch (err) {
      alert(`Error al subir archivo: ${err.message}`);
    }
    setIsUploading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">{task ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-board)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-md)', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: isTimerRunning ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                  {Math.floor(timeSpent / 3600).toString().padStart(2, '0')}:
                  {Math.floor((timeSpent % 3600) / 60).toString().padStart(2, '0')}:
                  {(timeSpent % 60).toString().padStart(2, '0')}
                </span>
                <button type="button" className={`btn btn-ghost ${isTimerRunning ? 'danger' : ''}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setIsTimerRunning(!isTimerRunning)}>
                  {isTimerRunning ? 'Detener' : 'Play'}
                </button>
              </div>
              <button type="button" className="action-btn" onClick={onClose}><X size={20} /></button>
            </div>
          </div>
          
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Título</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="¿Qué hay que hacer?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Descripción</label>
                <div>
                  <button type="button" className={`btn btn-ghost ${!isPreview ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', opacity: isPreview ? 0.5 : 1 }} onClick={() => setIsPreview(false)}>Editar (Markdown)</button>
                  <button type="button" className={`btn btn-ghost ${isPreview ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', opacity: !isPreview ? 0.5 : 1 }} onClick={() => setIsPreview(true)}>Vista Previa</button>
                </div>
              </div>
              
              {!isPreview ? (
                <textarea 
                  className="form-textarea" 
                  placeholder="Detalles de la tarea... (Soporta Markdown, ej: **negrita**, - listas)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              ) : (
                <div className="form-textarea markdown-preview" style={{ minHeight: '100px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
                  {description ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                  ) : (
                    <span className="text-muted">Sin descripción.</span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Prioridad</label>
                <select 
                  className="form-select" 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">🟢 Baja</option>
                  <option value="medium">🟡 Media</option>
                  <option value="high">🔴 Alta</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vencimiento</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                  />
                  <CalendarIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Etiquetas</label>
              <div className="tags-container">
                {tags.map(tag => (
                  <span key={tag} className="tag-badge">
                    {tag} <button type="button" onClick={() => removeTag(tag)}><X size={12}/></button>
                  </span>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Escribe y presiona Enter..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                />
                <Tag size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Subtasks */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Subtareas</label>
                {onAutosuggest && (
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--accent-secondary)' }}
                    onClick={async () => {
                      if (!title.trim()) return alert('Pon un título primero');
                      setIsGenerating(true);
                      const suggested = await onAutosuggest(title);
                      if (suggested.length > 0) setSubtasks([...subtasks, ...suggested]);
                      setIsGenerating(false);
                    }}
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Generando...' : '✨ Autocompletar'}
                  </button>
                )}
              </div>
              <div className="subtasks-container">
                {subtasks.map(st => (
                  <div key={st.id} className="subtask-item">
                    <input type="checkbox" checked={st.completed} onChange={() => toggleSubtask(st.id)} />
                    <span style={{ textDecoration: st.completed ? 'line-through' : 'none', flex: 1, opacity: st.completed ? 0.5 : 1 }}>{st.title}</span>
                    <button type="button" className="action-btn danger" onClick={() => removeSubtask(st.id)}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Añadir subtarea y presiona Enter..."
                  value={subtaskInput}
                  onChange={e => setSubtaskInput(e.target.value)}
                  onKeyDown={handleAddSubtask}
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                />
                <CheckSquare size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Attachments */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Archivos Adjuntos</label>
                <label className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                  {isUploading ? 'Subiendo...' : <><UploadCloud size={14}/> Subir</>}
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
                </label>
              </div>
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {attachments.map(att => (
                    <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="subtask-item" style={{ textDecoration: 'none', color: 'var(--text-main)' }}>
                      <Paperclip size={14} color="var(--accent-primary)"/>
                      <span>{att.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="form-group">
              <label className="form-label">Comentarios</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {comments.map(c => (
                  <div key={c.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <p style={{ fontSize: '0.85rem' }}>{c.text}</p>
                    <small style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(c.date).toLocaleString()}</small>
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Escribe un comentario (Enter)..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={handleAddComment}
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                />
                <MessageSquare size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Guardar Tarea</button>
          </div>
        </form>
      </div>
    </div>
  );
}
