import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db.js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(helmet({
  crossOriginResourcePolicy: false, // Permitir cargar imágenes locales temporalmente si hace falta
}));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-focusboard';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  const textParts = text.split(':');
  if (textParts.length !== 2) return text;
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 peticiones por IP
  message: { error: 'Demasiados intentos. Por favor intenta de nuevo en 15 minutos.' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 peticiones por IP por minuto
  message: { error: 'Límite de peticiones excedido.' }
});

app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/external/', apiLimiter);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext);
  }
});
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo imágenes y PDFs.'));
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

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
    const user = await dbGet(`SELECT username, apiKey, openaiKey, unsplashKey, openaiModel, aiProvider, ollamaUrl, ollamaModel, openrouterKey, openrouterModel FROM users WHERE id = ?`, [req.userId]);
    if (user) {
      res.json({
        username: user.username,
        apiKey: user.apiKey,
        hasOpenaiKey: !!user.openaiKey,
        hasUnsplashKey: !!user.unsplashKey,
        hasOpenrouterKey: !!user.openrouterKey,
        openaiModel: user.openaiModel || 'gemini-1.5-flash',
        aiProvider: user.aiProvider || 'gemini',
        ollamaUrl: user.ollamaUrl || 'http://localhost:11434',
        ollamaModel: user.ollamaModel || 'llama3',
        openrouterModel: user.openrouterModel || 'meta-llama/llama-3-8b-instruct:free'
      });
    } else {
      res.json({});
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/me', authenticate, async (req, res) => {
  const { openaiKey, unsplashKey, openaiModel, aiProvider, ollamaUrl, ollamaModel, openrouterKey, openrouterModel } = req.body;
  try {
    const user = await dbGet(`SELECT openaiKey, unsplashKey, openaiModel, aiProvider, ollamaUrl, ollamaModel, openrouterKey, openrouterModel FROM users WHERE id = ?`, [req.userId]);
    
    // Solo actualizar si nos enviaron una nueva llave
    const encryptedOpenai = openaiKey !== undefined ? encrypt(openaiKey) : user.openaiKey;
    const encryptedUnsplash = unsplashKey !== undefined ? encrypt(unsplashKey) : user.unsplashKey;
    const encryptedOpenrouter = openrouterKey !== undefined ? encrypt(openrouterKey) : user.openrouterKey;
    
    const newModel = openaiModel !== undefined ? openaiModel : (user.openaiModel || 'gemini-1.5-flash');
    const newProvider = aiProvider !== undefined ? aiProvider : (user.aiProvider || 'gemini');
    const newOllamaUrl = ollamaUrl !== undefined ? ollamaUrl : (user.ollamaUrl || 'http://localhost:11434');
    const newOllamaModel = ollamaModel !== undefined ? ollamaModel : (user.ollamaModel || 'llama3');
    const newOpenrouterModel = openrouterModel !== undefined ? openrouterModel : (user.openrouterModel || 'meta-llama/llama-3-8b-instruct:free');
    
    await dbRun(`UPDATE users SET openaiKey = ?, unsplashKey = ?, openaiModel = ?, aiProvider = ?, ollamaUrl = ?, ollamaModel = ?, openrouterKey = ?, openrouterModel = ? WHERE id = ?`, 
      [encryptedOpenai, encryptedUnsplash, newModel, newProvider, newOllamaUrl, newOllamaModel, encryptedOpenrouter, newOpenrouterModel, req.userId]);
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
    io.emit('boardUpdate', req.userId); // Notify clients
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
    io.emit('boardUpdate', req.userId); // Notify clients
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    await dbRun(`DELETE FROM tasks WHERE id = ? AND userId = ?`, [req.params.id, req.userId]);
    io.emit('boardUpdate', req.userId); // Notify clients
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
    const user = await dbGet(`SELECT openaiKey, openaiModel, aiProvider, ollamaUrl, ollamaModel, openrouterKey, openrouterModel FROM users WHERE id = ?`, [req.userId]);
    const provider = user?.aiProvider || 'gemini';
    const promptText = `You are an assistant that breaks down a task title into 3 to 5 actionable subtasks. Return ONLY a valid JSON array of strings, e.g. ["Task 1", "Task 2"]. No markdown formatting, just the raw JSON array. Task: ${title}\nDescription: ${description || ''}`;

    let content = '';

    if (provider === 'gemini') {
      if (!user || !user.openaiKey) {
        return res.json({ subtasks: [
          { id: uuidv4(), title: `Investigar sobre ${title}`, completed: false },
          { id: uuidv4(), title: 'Crear borrador', completed: false }
        ]});
      }

      const decryptedKey = decrypt(user.openaiKey);
      const model = user.openaiModel || 'gemini-1.5-flash';
      const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      });
      
      if (!aiRes.ok) {
        const errData = await aiRes.json();
        console.error("Gemini API Error:", errData);
        throw new Error(`Error de Gemini: ${errData.error?.message || 'Error desconocido'}`);
      }
      const data = await aiRes.json();
      content = data.candidates[0].content.parts[0].text;
    } else if (provider === 'ollama') {
      const ollamaUrl = user.ollamaUrl || 'http://localhost:11434';
      const ollamaModel = user.ollamaModel || 'llama3';
      const aiRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: promptText,
          stream: false,
          format: 'json'
        })
      });

      if (!aiRes.ok) throw new Error(`Error conectando con Ollama en ${ollamaUrl}`);
      const data = await aiRes.json();
      content = data.response;
    } else if (provider === 'openrouter') {
      if (!user || !user.openrouterKey) {
        return res.json({ subtasks: [
          { id: uuidv4(), title: `Investigar sobre ${title}`, completed: false },
          { id: uuidv4(), title: 'Crear borrador', completed: false }
        ]});
      }

      const decryptedKey = decrypt(user.openrouterKey).trim();
      const openrouterModel = user.openrouterModel || 'meta-llama/llama-3-8b-instruct:free';
      const aiRes = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${decryptedKey}`,
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'FocusBoard'
        },
        body: JSON.stringify({
          model: openrouterModel,
          messages: [{ role: 'user', content: promptText }]
        })
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json();
        console.error("OpenRouter API Error:", errData);
        throw new Error(`Error de OpenRouter: ${errData.error?.message || 'Error desconocido'}`);
      }
      const data = await aiRes.json();
      content = data.choices[0].message.content;
    }

    // Clean up potential markdown formatting from AI response
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
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

    const decryptedKey = decrypt(user.unsplashKey);
    const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1`, {
      headers: { 'Authorization': `Client-ID ${decryptedKey}` }
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

// CHATBOT ENDPOINT
app.post('/api/external/chat', authenticate, async (req, res) => {
  const { message } = req.body;
  try {
    const user = await dbGet(`SELECT openaiKey, openaiModel, aiProvider, ollamaUrl, ollamaModel, openrouterKey, openrouterModel FROM users WHERE id = ?`, [req.userId]);
    const provider = user?.aiProvider || 'gemini';
    
    if (provider === 'gemini' && (!user || !user.openaiKey)) {
      return res.status(400).json({ error: 'Falta tu llave de Gemini en Ajustes.' });
    }
    if (provider === 'openrouter' && (!user || !user.openrouterKey)) {
      return res.status(400).json({ error: 'Falta tu llave de OpenRouter en Ajustes.' });
    }

    // Extraer todo el contexto del tablero para mandarlo a la IA
    const tasksRows = await dbAll(`SELECT title, columnId, priority, dueDate FROM tasks WHERE userId = ?`, [req.userId]);
    const state = await dbGet(`SELECT columnsJSON FROM board_state WHERE userId = ?`, [req.userId]);
    const columns = state ? JSON.parse(state.columnsJSON) : {};

    const contextStr = tasksRows.map(t => {
      const colName = columns[t.columnId] ? columns[t.columnId].title : 'Desconocida';
      return `- Tarea: "${t.title}", Columna: ${colName}, Prioridad: ${t.priority}, Vence: ${t.dueDate || 'Sin fecha'}`;
    }).join('\n');

    const prompt = `
Eres un asistente inteligente para la herramienta "FocusBoard" gestionando las tareas del usuario.
Aquí está la lista actual de las tareas del usuario y en qué columna del tablero Kanban se encuentran:
${contextStr}

El usuario te dice: "${message}"

Responde de forma concisa y amigable basándote en la información de sus tareas.
`;

    let reply = '';

    if (provider === 'gemini') {
      const decryptedKey = decrypt(user.openaiKey);
      const model = user.openaiModel || 'gemini-1.5-flash';
      const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      if (!aiRes.ok) {
        const errData = await aiRes.json();
        console.error("Gemini API Error:", errData);
        throw new Error(`Error de Gemini: ${errData.error?.message || 'Error desconocido'}`);
      }
      const data = await aiRes.json();
      reply = data.candidates[0].content.parts[0].text;
    } else if (provider === 'ollama') {
      const ollamaUrl = user.ollamaUrl || 'http://localhost:11434';
      const ollamaModel = user.ollamaModel || 'llama3';
      const aiRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false
        })
      });

      if (!aiRes.ok) throw new Error(`Error conectando con Ollama en ${ollamaUrl}`);
      const data = await aiRes.json();
      reply = data.response;
    } else if (provider === 'openrouter') {
      const decryptedKey = decrypt(user.openrouterKey).trim();
      const openrouterModel = user.openrouterModel || 'meta-llama/llama-3-8b-instruct:free';
      const aiRes = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${decryptedKey}`,
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'FocusBoard'
        },
        body: JSON.stringify({
          model: openrouterModel,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json();
        console.error("OpenRouter API Error:", errData);
        throw new Error(`Error de OpenRouter: ${errData.error?.message || 'Error desconocido'}`);
      }
      const data = await aiRes.json();
      reply = data.choices[0].message.content;
    }
    
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
