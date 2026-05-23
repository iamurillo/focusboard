import { Calendar, Tag } from 'lucide-react';

export default function ListView({ tasks, columns }) {
  const allTasks = Object.values(tasks);
  
  if (allTasks.length === 0) {
    return <div className="loading">No hay tareas para mostrar.</div>;
  }

  return (
    <div className="list-view-container">
      <table className="list-view-table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Vencimiento</th>
            <th>Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {allTasks.map(task => (
            <tr key={task.id}>
              <td style={{ fontWeight: 500 }}>{task.title}</td>
              <td>{columns[task.columnId]?.title || 'Desconocido'}</td>
              <td>
                <span className={`priority-badge priority-${task.priority}`}>
                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                </span>
              </td>
              <td>
                {task.dueDate ? (
                   <span className="meta-item"><Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString()}</span>
                ) : '-'}
              </td>
              <td>
                {task.tags && task.tags.length > 0 ? (
                  <div className="task-tags" style={{ marginBottom: 0 }}>
                    {task.tags.map(tag => (
                      <span key={tag} className="tag-badge"><Tag size={10}/> {tag}</span>
                    ))}
                  </div>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
