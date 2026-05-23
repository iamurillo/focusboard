import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Promisify db functions
const dbGet = (query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbRun = (query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));

// Initialize board state if empty
async function initBoard() {
  const state = await dbGet(`SELECT * FROM board_state WHERE id = 'main'`);
  if (!state) {
    const initialColumns = {
      todo: { id: 'todo', title: 'Por Hacer', taskIds: [] },
      inProgress: { id: 'inProgress', title: 'En Progreso', taskIds: [] },
      done: { id: 'done', title: 'Hecho', taskIds: [] }
    };
    const initialOrder = ['todo', 'inProgress', 'done'];
    await dbRun(`INSERT INTO board_state (id, columnsJSON, columnOrderJSON) VALUES (?, ?, ?)`, 
      ['main', JSON.stringify(initialColumns), JSON.stringify(initialOrder)]
    );
  }
}
initBoard();

// Get full board state
app.get('/api/board', async (req, res) => {
  try {
    const state = await dbGet(`SELECT * FROM board_state WHERE id = 'main'`);
    const tasksRows = await dbAll(`SELECT * FROM tasks`);
    
    const tasks = {};
    tasksRows.forEach(row => {
      tasks[row.id] = {
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
        subtasks: row.subtasks ? JSON.parse(row.subtasks) : []
      };
    });

    res.json({
      tasks,
      columns: JSON.parse(state.columnsJSON),
      columnOrder: JSON.parse(state.columnOrderJSON)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save full board state (columns and order)
app.post('/api/board', async (req, res) => {
  const { columns, columnOrder } = req.body;
  try {
    await dbRun(`UPDATE board_state SET columnsJSON = ?, columnOrderJSON = ? WHERE id = 'main'`, 
      [JSON.stringify(columns), JSON.stringify(columnOrder)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update task
app.post('/api/tasks', async (req, res) => {
  const { id, title, description, priority, dueDate, columnId, position, tags, subtasks } = req.body;
  try {
    const existing = await dbGet(`SELECT id FROM tasks WHERE id = ?`, [id]);
    
    if (existing) {
      await dbRun(`UPDATE tasks SET title = ?, description = ?, priority = ?, dueDate = ?, columnId = ?, position = ?, tags = ?, subtasks = ? WHERE id = ?`,
        [title, description, priority, dueDate, columnId, position || 0, JSON.stringify(tags || []), JSON.stringify(subtasks || []), id]
      );
    } else {
      await dbRun(`INSERT INTO tasks (id, title, description, priority, dueDate, columnId, position, tags, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, description, priority, dueDate, columnId, position || 0, JSON.stringify(tags || []), JSON.stringify(subtasks || [])]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await dbRun(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
