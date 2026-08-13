-- Per-room JSON config (approvalChain, future settings). Same pattern as translation-settings extensibility.
CREATE TABLE IF NOT EXISTS room_config (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_config_project
  ON room_config (project_id, updated_at DESC);
