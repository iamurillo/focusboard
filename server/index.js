import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = 3001;
const JWT_SECRET = 'super-secret-key-for-focusboard';

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

const dbGet = (query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbRun = (query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    const user = await dbGet(`SELECT id FROM users WHERE apiKey = ?`, [apiKey]);
    if (user) { req.userId = user.id; return next(); }
  }

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  }
  
  if (!req.userId) return res.status(401).json({ error: 'No autorizado' });
};

// --- AUTH ENDPOINTS ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await dbGet(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) return res.status(400).json({ error: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const apiKey = `fb-${uuidv4()}`;

    await dbRun(`INSERT INTO users (id, username, password, apiKey) VALUES (?, ?, ?, ?)`, [userId, username, hashedPassword, apiKey]);
    
    const initialColumns = {
      todo: { id: 'todo', title: 'Por Hacer', taskIds: [] },
      inProgress: { id: 'inProgress', title: 'En Progreso', taskIds: [] },
      done: { id: 'done', title: 'Hecho', taskIds: [] }
    };
    const initialOrder = ['todo', 'inProgress', 'done'];
    await dbRun(`INSERT INTO board_state (userId, columnsJSON, columnOrderJSON, bgImageUrl, appName) VALUES (?, ?, ?, ?, ?)`, 
      [userId, JSON.stringify(initialColumns), JSON.stringify(initialOrder), '', 'FocusBoard']
    );

    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await dbGet(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, apiKey: user.apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', authenticate, async (req, res) => {
  try {
    const user = await dbGet(`SELECT username, apiKey, openaiKey, unsplashKey FROM users WHERE id = ?`, [req.userId]);
    res.json(user || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/me', authenticate, async (req, res) => {
  const { openaiKey, unsplashKey } = req.body;
  try {
    await dbRun(`UPDATE users SET openaiKey = ?, unsplashKey = ? WHERE id = ?`, [openaiKey, unsplashKey, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BOARD ENDPOINTS ---
app.get('/api/board', authenticate, async (req, res) => {
  try {
    const state = await dbGet(`SELECT * FROM board_state WHERE userId = ?`, [req.userId]);
    const tasksRows = await dbAll(`SELECT * FROM tasks WHERE userId = ?`, [req.userId]);
    
    const tasks = {};
    tasksRows.forEach(row => {
      tasks[row.id] = {
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
        subtasks: row.subtasks ? JSON.parse(row.subtasks) : [],
        comments: row.comments ? JSON.parse(row.comments) : [],
        attachments: row.attachments ? JSON.parse(row.attachments) : []
      };
    });

    res.json({
      tasks,
      columns: state ? JSON.parse(state.columnsJSON) : {},
      columnOrder: state ? JSON.parse(state.columnOrderJSON) : [],
      bgImageUrl: state ? state.bgImageUrl : '',
      appName: state ? state.appName : 'FocusBoard'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/board', authenticate, async (req, res) => {
  const { columns, columnOrder, bgImageUrl, appName } = req.body;
  try {
    await dbRun(`UPDATE board_state SET columnsJSON=?, columnOrderJSON=?, bgImageUrl=?, appName=? WHERE userId=?`, 
      [JSON.stringify(columns), JSON.stringify(columnOrder), bgImageUrl || '', appName || 'FocusBoard', req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { id, title, description, priority, dueDate, columnId, position, tags, subtasks, comments, attachments, timeSpent } = req.body;
  try {
    const existing = await dbGet(`SELECT id FROM tasks WHERE id = ? AND userId = ?`, [id, req.userId]);
    
    if (existing) {
      await dbRun(`UPDATE tasks SET title=?, description=?, priority=?, dueDate=?, columnId=?, position=?, tags=?, subtasks=?, comments=?, attachments=?, timeSpent=? WHERE id=? AND userId=?`,
        [title, description, priority, dueDate, columnId, position || 0, JSON.stringify(tags || []), JSON.stringify(subtasks || []), JSON.stringify(comments || []), JSON.stringify(attachments || []), timeSpent || 0, id, req.userId]
      );
    } else {
      await dbRun(`INSERT INTO tasks (id, userId, title, description, priority, dueDate, columnId, position, tags, subtasks, comments, attachments, timeSpent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.userId, title, description, priority, dueDate, columnId, position || 0, JSON.stringify(tags || []), JSON.stringify(subtasks || []), JSON.stringify(comments || []), JSON.stringify(attachments || []), timeSpent || 0]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    await dbRun(`DELETE FROM tasks WHERE id = ? AND userId = ?`, [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ACTIVITY LOGS ---
app.get('/api/logs', authenticate, async (req, res) => {
  try {
    const logs = await dbAll(`SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 50`, [req.userId]);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logs', authenticate, async (req, res) => {
  const { action } = req.body;
  try {
    await dbRun(`INSERT INTO activity_logs (id, userId, action, timestamp) VALUES (?, ?, ?, ?)`,
      [uuidv4(), req.userId, action, new Date().toISOString()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint
app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const fileUrl = `http://localhost:3001/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, name: req.file.originalname });
});

// --- EXTERNAL APIs PROXIES ---
app.post('/api/external/autocomplete', authenticate, async (req, res) => {
  const { title, description } = req.body;
  try {
    const user = await dbGet(`SELECT openaiKey FROM users WHERE id = ?`, [req.userId]);
    if (!user || !user.openaiKey) {
      return res.json({ subtasks: [
        { id: uuidv4(), title: `Investigar sobre ${title}`, completed: false },
        { id: uuidv4(), title: 'Crear borrador', completed: false }
      ]});
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are an assistant that breaks down a task title into 3 to 5 actionable subtasks. Return ONLY a JSON array of strings, e.g. ["Task 1", "Task 2"].'
        }, {
          role: 'user',
          content: `Task: ${title}\nDescription: ${description || ''}`
        }]
      })
    });
    
    if (!aiRes.ok) throw new Error('Error de OpenAI. Verifica tu API Key.');
    const data = await aiRes.json();
    const content = data.choices[0].message.content;
    const subtaskArray = JSON.parse(content);
    
    const subtasks = subtaskArray.map(st => ({ id: uuidv4(), title: st, completed: false }));
    res.json({ subtasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/external/unsplash', authenticate, async (req, res) => {
  const { query } = req.query;
  try {
    const user = await dbGet(`SELECT unsplashKey FROM users WHERE id = ?`, [req.userId]);
    if (!user || !user.unsplashKey) return res.status(400).json({ error: 'No Unsplash API Key config.' });

    const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1`, {
      headers: { 'Authorization': `Client-ID ${user.unsplashKey}` }
    });
    
    const data = await unsplashRes.json();
    if (data.results && data.results.length > 0) {
      res.json({ url: data.results[0].urls.regular });
    } else {
      res.status(404).json({ error: 'No image found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
