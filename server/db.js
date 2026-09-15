import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path = "data/memify.db") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL COLLATE NOCASE, password TEXT NOT NULL, name TEXT NOT NULL, goal INTEGER NOT NULL DEFAULT 10, topic TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT 'Curious beginner', verified INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Personal', color TEXT NOT NULL DEFAULT 'sage', icon TEXT NOT NULL DEFAULT 'layers', source TEXT, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE, front TEXT NOT NULL, back TEXT NOT NULL, due INTEGER NOT NULL, interval REAL NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.5, repetitions INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, card_id TEXT REFERENCES cards(id) ON DELETE SET NULL, rating TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS decks_user ON decks(user_id);
    CREATE INDEX IF NOT EXISTS cards_deck ON cards(deck_id);
    CREATE INDEX IF NOT EXISTS reviews_user_time ON reviews(user_id, created);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    INSERT OR IGNORE INTO migrations VALUES (1, unixepoch() * 1000);
  `);
  return db;
}
