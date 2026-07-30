-- Room capability platform: versioned domain events with idempotency (ROADMAP 5.3+)

CREATE TABLE IF NOT EXISTS room_capability_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  vertical TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_role TEXT,
  idempotency_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_capability_idempotency
  ON room_capability_events(project_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_room_capability_room
  ON room_capability_events(project_id, room_id, occurred_at);
