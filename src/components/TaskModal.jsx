import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function TaskModal({ isOpen, onClose, onSave, task = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  
  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate || '');
      setTags(task.tags || []);
      setSubtasks(task.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setTags([]);
      setSubtasks([]);
    }
    setTagInput('');
    setSubtaskInput('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (subtaskInput.trim()) {
      setSubtasks([...subtasks, { id: uuidv4(), title: subtaskInput.trim(), completed: false }]);
      setSubtaskInput('');
    }
  };

  const handleToggleSubtask = (id) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      tags,
      subtasks
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{task ? 'Editar Tarea' : 'Nueva Tarea'}</div>
          <button className="action-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Título</label>
            <input type="text" className="form-input" placeholder="¿Qué hay que hacer?" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
          </div>
          
          <div className="form-group">
            <label className="form-label">Descripción (Opcional)</label>
            <textarea className="form-textarea" placeholder="Añade más detalles..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Prioridad</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Fecha Límite</label>
              <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Etiquetas</label>
            <div className="tags-container">
              {tags.map(tag => (
                <span key={tag} className="tag-badge">
                  {tag} <button type="button" onClick={() => handleRemoveTag(tag)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="form-input" placeholder="Nueva etiqueta" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag(e)} />
              <button type="button" className="btn btn-ghost" onClick={handleAddTag}><Plus size={16} /></button>
            </div>
          </div>

          {/* Subtasks */}
          <div className="form-group">
            <label className="form-label">Subtareas</label>
            <div className="subtasks-container">
              {subtasks.map(st => (
                <div key={st.id} className="subtask-item">
                  <input type="checkbox" checked={st.completed} onChange={() => handleToggleSubtask(st.id)} />
                  <span style={{ textDecoration: st.completed ? 'line-through' : 'none', flex: 1 }}>{st.title}</span>
                  <button type="button" className="action-btn" onClick={() => handleRemoveSubtask(st.id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="form-input" placeholder="Nueva subtarea" value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask(e)} />
              <button type="button" className="btn btn-ghost" onClick={handleAddSubtask}><Plus size={16} /></button>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!title.trim()}>Guardar Tarea</button>
        </div>
      </div>
    </div>
  );
}
