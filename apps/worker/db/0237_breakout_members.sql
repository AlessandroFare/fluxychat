CREATE TABLE IF NOT EXISTS breakout_members (
  breakout_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (breakout_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_breakout_members_parent
  ON breakout_members (project_id, user_id);
