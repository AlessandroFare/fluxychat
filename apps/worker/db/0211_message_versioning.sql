-- Message versioning: monotonic seq per room + event log for WS resume replay.

ALTER TABLE messages ADD COLUMN seq INTEGER;
ALTER TABLE messages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS room_message_seq (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, room_id)
);

CREATE TABLE IF NOT EXISTS room_message_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'update', 'delete')),
  version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, room_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_room_message_events_replay
  ON room_message_events (project_id, room_id, seq ASC);

CREATE INDEX IF NOT EXISTS idx_hitl_approval_expires
  ON hitl_approval_requests (status, expires_at ASC)
  WHERE status = 'pending';
