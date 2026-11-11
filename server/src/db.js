const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.TIMELINE_DATA_DIR || path.join(__dirname, "..", "data");
const DB_PATH = process.env.TIMELINE_DB_PATH || path.join(DATA_DIR, "timeline.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '未命名',
    rounds INTEGER NOT NULL DEFAULT 0,
    minutes REAL NOT NULL DEFAULT 0,
    device TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    ended_at TEXT,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_updated
    ON sessions(user_id, updated_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_ended
    ON sessions(user_id, ended_at);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("users", "display_name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("users", "bio", "TEXT NOT NULL DEFAULT ''");
ensureColumn("users", "is_public", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "public_title", "TEXT NOT NULL DEFAULT ''");

module.exports = { db, DB_PATH, DATA_DIR };
