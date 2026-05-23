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
  // We'll store tasks with tags and subtasks as JSON strings for simplicity 
  // since SQLite supports JSON and it makes React state mapping 1:1 easier.
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    priority TEXT,
    dueDate TEXT,
    columnId TEXT,
    position INTEGER,
    tags TEXT,
    subtasks TEXT
  )`);

  // Default columns are hardcoded in the frontend, but let's store them just in case
  db.run(`CREATE TABLE IF NOT EXISTS board_state (
    id TEXT PRIMARY KEY,
    columnsJSON TEXT,
    columnOrderJSON TEXT
  )`);
});

export default db;
