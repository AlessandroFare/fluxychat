-- Per-user watchlist (Pusher-style): follow rooms or users for events on the user channel.
CREATE TABLE IF NOT EXISTS user_watchlist (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('room', 'user')),
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_target
  ON user_watchlist (project_id, target_type, target_id);
