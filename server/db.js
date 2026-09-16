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

    -- Migration 2: subscriptions, the shared deck library, and workspace tools.
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      renews INTEGER,
      reference TEXT,
      updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_decks (
      id TEXT PRIMARY KEY,
      deck_id TEXT REFERENCES decks(id) ON DELETE SET NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Personal',
      color TEXT NOT NULL DEFAULT 'sage',
      cards TEXT NOT NULL,
      card_count INTEGER NOT NULL DEFAULT 0,
      votes INTEGER NOT NULL DEFAULT 0,
      saves INTEGER NOT NULL DEFAULT 0,
      seeded INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_votes (
      shared_id TEXT NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created INTEGER NOT NULL,
      PRIMARY KEY (shared_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled',
      body TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT '{}',
      updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      minutes INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'focus',
      created INTEGER NOT NULL
    );
    -- Local record of generation usage so free-tier quota can be enforced
    -- without a round trip to the cloud service.
    CREATE TABLE IF NOT EXISTS generations_local (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cards INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS generations_local_user ON generations_local(user_id, created);
    CREATE INDEX IF NOT EXISTS shared_rank ON shared_decks(votes DESC, created DESC);
    CREATE INDEX IF NOT EXISTS shared_category ON shared_decks(category);
    CREATE INDEX IF NOT EXISTS shared_owner ON shared_decks(user_id);
    CREATE INDEX IF NOT EXISTS notes_user ON notes(user_id, position);
    CREATE INDEX IF NOT EXISTS focus_user_time ON focus_sessions(user_id, created);
    INSERT OR IGNORE INTO migrations VALUES (2, unixepoch() * 1000);
  `);

  // Migration 3: deck appearance (free colour, icon, uploaded banner).
  // Added with ALTER so existing decks keep their rows.
  const deckColumns = new Set(
    db
      .prepare("PRAGMA table_info(decks)")
      .all()
      .map((c) => c.name),
  );
  for (const [name, definition] of [
    ["accent", "TEXT NOT NULL DEFAULT ''"],
    ["banner", "TEXT NOT NULL DEFAULT ''"],
  ])
    if (!deckColumns.has(name))
      db.exec(`ALTER TABLE decks ADD COLUMN ${name} ${definition}`);
  db.exec(`
    -- Migration 4: generations the user has saved or dismissed drop out
    -- of the recent list rather than lingering after they are dealt with.
    CREATE TABLE IF NOT EXISTS generation_state (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS generation_state_user ON generation_state(user_id);
    INSERT OR IGNORE INTO migrations VALUES (3, unixepoch() * 1000);
    INSERT OR IGNORE INTO migrations VALUES (4, unixepoch() * 1000);
  `);
  return db;
}
