-- P14-J: Rate Limit Dashboard
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  limit_val INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  current_count INTEGER DEFAULT 0,
  retry_after_seconds INTEGER DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rl_events_project ON rate_limit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_rl_events_key ON rate_limit_events(key);
CREATE INDEX IF NOT EXISTS idx_rl_events_created ON rate_limit_events(created_at);
