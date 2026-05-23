import { Draggable } from '@hello-pangea/dnd';
import { Edit2, Trash2, Calendar, CheckSquare, Tag } from 'lucide-react';

export default function TaskCard({ task, index, onDelete, onEdit }) {
  const completedSubtasks = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;

  // Check if due date is passed
  let isOverdue = false;
  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    isOverdue = dueDate < today;
  }

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
          style={provided.draggableProps.style}
        >
          <div className={`task-priority-indicator priority-${task.priority}`} />
          
          <div className="task-title">{task.title}</div>
          
          {task.tags && task.tags.length > 0 && (
            <div className="task-tags">
              {task.tags.map(tag => (
                <span key={tag} className="tag-badge"><Tag size={10} /> {tag}</span>
              ))}
            </div>
          )}

          {task.description && (
            <div className="task-desc">{task.description}</div>
          )}

          <div className="task-meta-info">
            {task.dueDate && (
              <span className={`meta-item ${isOverdue ? 'overdue' : ''}`} title="Fecha de vencimiento">
                <Calendar size={12} />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {totalSubtasks > 0 && (
              <span className={`meta-item ${completedSubtasks === totalSubtasks ? 'completed' : ''}`} title="Subtareas">
                <CheckSquare size={12} />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </div>
          
          <div className="task-footer">
            <div className="task-badge">
              <span style={{ textTransform: 'capitalize' }}>
                {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                className="action-btn" 
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                title="Editar tarea"
              >
                <Edit2 size={14} />
              </button>
              <button 
                className="action-btn danger" 
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                title="Eliminar tarea"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
