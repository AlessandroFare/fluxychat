CREATE TABLE IF NOT EXISTS do_locks (
  key TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_do_locks_expires
  ON do_locks (expires_at);
