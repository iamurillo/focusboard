import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    apiKey TEXT UNIQUE,
    openaiKey TEXT,
    unsplashKey TEXT,
    openaiModel TEXT DEFAULT 'gemini-1.5-flash',
    aiProvider TEXT DEFAULT 'gemini',
    ollamaUrl TEXT DEFAULT 'http://localhost:11434',
    ollamaModel TEXT DEFAULT 'llama3'
  )`);

  // Add column if it doesn't exist (migration)
  db.run(`ALTER TABLE users ADD COLUMN openaiModel TEXT DEFAULT 'gemini-1.5-flash'`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN aiProvider TEXT DEFAULT 'gemini'`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN ollamaUrl TEXT DEFAULT 'http://localhost:11434'`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN ollamaModel TEXT DEFAULT 'llama3'`, (err) => {});

  // Tasks table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    userId TEXT,
    title TEXT,
    description TEXT,
    priority TEXT,
    dueDate TEXT,
    columnId TEXT,
    position INTEGER,
    tags TEXT,
    subtasks TEXT,
    comments TEXT,
    attachments TEXT,
    timeSpent INTEGER DEFAULT 0
  )`);

  // Board state per user
  db.run(`CREATE TABLE IF NOT EXISTS board_state (
    userId TEXT PRIMARY KEY,
    columnsJSON TEXT,
    columnOrderJSON TEXT,
    bgImageUrl TEXT,
    appName TEXT
  )`);

  // Activity Logs
  db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    action TEXT,
    timestamp TEXT
  )`);
});

export default db;
