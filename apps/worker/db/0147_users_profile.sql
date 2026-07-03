-- User profiles (Clerk-linked)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT UNIQUE,
  display_name TEXT,
  image_url TEXT,
  email TEXT,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_user_id);
