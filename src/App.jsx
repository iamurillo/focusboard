import { useState, useEffect } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { Layout, Plus, Search } from 'lucide-react';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [tasks, setTasks] = useState({});
  const [columns, setColumns] = useState({});
  const [columnOrder, setColumnOrder] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addingToColumn, setAddingToColumn] = useState(null);

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    try {
      const res = await fetch(`${API_URL}/board`);
      const data = await res.json();
      setTasks(data.tasks || {});
      setColumns(data.columns || {});
      setColumnOrder(data.columnOrder || []);
      setIsReady(true);
    } catch (err) {
      console.error('Failed to load board', err);
    }
  };

  const saveBoardState = async (newColumns, newColumnOrder) => {
    try {
      await fetch(`${API_URL}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: newColumns, columnOrder: newColumnOrder })
      });
    } catch (err) {
      console.error('Failed to save board', err);
    }
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const startColumn = columns[source.droppableId];
    const finishColumn = columns[destination.droppableId];

    if (startColumn === finishColumn) {
      const newTaskIds = Array.from(startColumn.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...startColumn, taskIds: newTaskIds };
      const newColumns = { ...columns, [newColumn.id]: newColumn };
      
      setColumns(newColumns);
      saveBoardState(newColumns, columnOrder);
      return;
    }

    const startTaskIds = Array.from(startColumn.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStartColumn = { ...startColumn, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finishColumn.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinishColumn = { ...finishColumn, taskIds: finishTaskIds };

    const newColumns = {
      ...columns,
      [newStartColumn.id]: newStartColumn,
      [newFinishColumn.id]: newFinishColumn,
    };

    setColumns(newColumns);
    saveBoardState(newColumns, columnOrder);
    
    // Update columnId in backend for the task
    const taskToUpdate = tasks[draggableId];
    if (taskToUpdate) {
      fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskToUpdate, columnId: finishColumn.id })
      });
    }
  };

  const handleOpenModal = (columnId = null, task = null) => {
    setAddingToColumn(columnId || 'todo');
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    let newTask = { ...taskData };
    if (!editingTask) {
      newTask.id = uuidv4();
      newTask.columnId = addingToColumn;
      
      const column = columns[addingToColumn];
      const newColumns = {
        ...columns,
        [addingToColumn]: {
          ...column,
          taskIds: [...column.taskIds, newTask.id]
        }
      };
      setColumns(newColumns);
      saveBoardState(newColumns, columnOrder);
    }

    setTasks({ ...tasks, [newTask.id]: newTask });
    
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });
    
    setIsModalOpen(false);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('¿Seguro que quieres eliminar esta tarea?')) return;

    const newTasks = { ...tasks };
    delete newTasks[taskId];
    setTasks(newTasks);

    const newColumns = { ...columns };
    for (const columnId in newColumns) {
      const col = newColumns[columnId];
      if (col.taskIds.includes(taskId)) {
        newColumns[columnId] = {
          ...col,
          taskIds: col.taskIds.filter(id => id !== taskId)
        };
      }
    }
    setColumns(newColumns);
    saveBoardState(newColumns, columnOrder);

    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
  };

  if (!isReady) return <div className="loading">Cargando Tablero...</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title">
          <Layout size={24} />
          FocusBoard
        </div>
        
        <div className="search-bar">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Buscar tareas, etiquetas..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenModal('todo')}>
          <Plus size={18} />
          Nueva Tarea
        </button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board-container">
          {columnOrder.map((columnId) => {
            const column = columns[columnId];
            if (!column) return null;
            
            const columnTasks = column.taskIds
              .map((taskId) => tasks[taskId])
              .filter(Boolean)
              .filter(t => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                const matchTitle = t.title.toLowerCase().includes(query);
                const matchDesc = t.description && t.description.toLowerCase().includes(query);
                const matchTags = t.tags && t.tags.some(tag => tag.toLowerCase().includes(query));
                return matchTitle || matchDesc || matchTags;
              });

            return (
              <div key={column.id} className="column">
                <div className="column-header">
                  <div className="column-title">
                    {column.title}
                    <span className="task-count">{columnTasks.length}</span>
                  </div>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      className="column-content"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {columnTasks.map((task, index) => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          index={index} 
                          onDelete={handleDeleteTask}
                          onEdit={(t) => handleOpenModal(null, t)}
                        />
                      ))}
                      {provided.placeholder}
                      
                      <button 
                        className="add-task-btn" 
                        onClick={() => handleOpenModal(column.id)}
                      >
                        <Plus size={16} /> Añadir tarea
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
      />
    </div>
  );
}
