import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { Layout, LayoutDashboard, Plus, Search, LogOut, BarChart2, List, Settings as SettingsIcon } from 'lucide-react';
import { io } from 'socket.io-client';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import Login from './components/Login';
import ListView from './components/ListView';
import ReportsView from './components/ReportsView';
import Settings from './components/Settings';
import CalendarView from './components/CalendarView';
import ActivityLog from './components/ActivityLog';
import Chatbot from './components/Chatbot';

const API_URL = 'http://localhost:3001/api';
const socket = io('http://localhost:3001');

// A protected route wrapper
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('focusboard_token'));
  
  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('focusboard_token');
    localStorage.removeItem('focusboard_apikey');
    setToken(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        <Route path="/*" element={
          <ProtectedRoute isAuthenticated={!!token}>
            <MainLayout token={token} onLogout={handleLogout} />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

function MainLayout({ token, onLogout }) {
  const [tasks, setTasks] = useState({});
  const [columns, setColumns] = useState({});
  const [columnOrder, setColumnOrder] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addingToColumn, setAddingToColumn] = useState(null);

  // App settings state
  const [appName, setAppName] = useState('FocusBoard');
  const [bgImage, setBgImage] = useState('linear-gradient(to bottom right, #0f1115, #1e2128)');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const location = useLocation();

  useEffect(() => {
    fetchBoard();

    // Setup WebSocket listener
    const handleBoardUpdate = (updatedUserId) => {
      // Decode JWT token to check user ID without making request if possible, 
      // but simpler: just refetch the board since it's authenticated to our token.
      fetchBoard();
    };

    socket.on('boardUpdate', handleBoardUpdate);

    return () => {
      socket.off('boardUpdate', handleBoardUpdate);
    };
  }, [token]);

  const fetchBoard = async () => {
    try {
      const res = await fetch(`${API_URL}/board`, { headers: authHeaders });
      if (res.status === 401) return onLogout();
      
      const data = await res.json();
      setTasks(data.tasks || {});
      setColumns(data.columns || {});
      setColumnOrder(data.columnOrder || []);
      if (data.bgImageUrl) setBgImage(data.bgImageUrl);
      if (data.appName) setAppName(data.appName);
      setIsReady(true);
    } catch (err) {
      console.error('Failed to load board', err);
    }
  };

  const logActivity = async (action) => {
    try {
      await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action })
      });
    } catch (e) {
      console.error('Failed to log activity', e);
    }
  };

  const saveBoardState = async (newColumns, newColumnOrder, newBg = bgImage) => {
    try {
      await fetch(`${API_URL}/board`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ columns: newColumns, columnOrder: newColumnOrder, bgImageUrl: newBg })
      });
    } catch (err) {
      console.error('Failed to save board', err);
    }
  };

  const handleBgChange = (newBg) => {
    setBgImage(newBg);
    saveBoardState(columns, columnOrder, newBg);
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

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
    logActivity(`Movió la tarea desde ${startColumn.title} hacia ${finishColumn.title}`);
    
    const taskToUpdate = tasks[draggableId];
    if (taskToUpdate) {
      fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: authHeaders,
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
        [addingToColumn]: { ...column, taskIds: [...column.taskIds, newTask.id] }
      };
      setColumns(newColumns);
      saveBoardState(newColumns, columnOrder);
    }

    setTasks({ ...tasks, [newTask.id]: newTask });
    
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newTask)
    });
    
    setIsModalOpen(false);
    logActivity(taskData.id ? `Actualizó la tarea "${taskData.title}"` : `Creó la tarea "${taskData.title}"`);
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

    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE', headers: authHeaders });
  };

  const handleAutosuggest = async (title) => {
    try {
      const res = await fetch(`${API_URL}/external/autocomplete`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title })
      });
      const data = await res.json();
      return data.subtasks || [];
    } catch {
      return [];
    }
  };

  if (!isReady) return <div className="loading">Cargando FocusBoard...</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="logo"><LayoutDashboard size={24} /> {appName}</div>
          <nav className="main-nav">
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Tablero</Link>
            <Link to="/list" className={`nav-link ${location.pathname === '/list' ? 'active' : ''}`}>Lista</Link>
            <Link to="/calendar" className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}>Calendario</Link>
            <Link to="/reports" className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}>Reportes</Link>
            <Link to="/activity" className={`nav-link ${location.pathname === '/activity' ? 'active' : ''}`}>Historial</Link>
          </nav>
        </div>
        
        <div className="search-bar">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <nav className="nav-menu">
          <Link to="/settings" className="btn btn-ghost"><SettingsIcon size={18}/> Ajustes</Link>
          <button className="btn btn-primary" onClick={() => handleOpenModal('todo')}><Plus size={18} /> Tarea</button>
          <button className="btn btn-ghost" onClick={onLogout}><LogOut size={18}/></button>
        </nav>
      </header>

      <div className="main-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={
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
                            style={{ backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                          >
                            {columnTasks.map((task, index) => (
                              <TaskCard key={task.id} task={task} index={index} onDelete={handleDeleteTask} onEdit={(t) => handleOpenModal(null, t)} />
                            ))}
                            {provided.placeholder}
                            <button className="add-task-btn" onClick={() => handleOpenModal(column.id)}>
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
          } />
          
          <Route path="/list" element={<ListView tasks={tasks} columns={columns} />} />
          <Route path="/calendar" element={<CalendarView tasks={tasks} columns={columns} />} />
          <Route path="/reports" element={<ReportsView tasks={tasks} columns={columns} />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/settings" element={<Settings onBgChange={handleBgChange} />} />
        </Routes>
      </div>

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        onAutosuggest={handleAutosuggest}
        token={token}
      />
      
      <Chatbot token={token} />
    </div>
  );
}
