// database.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules do not have __dirname, so we need to recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to your database file
const dbPath = path.resolve(__dirname, 'database.db');

// Initialize the database connection
const db = new Database(dbPath, { verbose: console.log });

// Create a table if it doesn't exist
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`);

export default db;
