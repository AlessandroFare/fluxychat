-- Room-level message retention / ephemeral policy (roadmap #19)

CREATE TABLE IF NOT EXISTS room_message_retention (
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (mode IN ('standard', 'ephemeral', 'custom')),
  ttl_seconds INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_retention_project
  ON room_message_retention (project_id, mode);
