-- P13-T1: Inbound SMS/WhatsApp → room (idempotency + audit)

CREATE TABLE IF NOT EXISTS telco_inbound_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  from_e164 TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telco_inbound_external
  ON telco_inbound_events (project_id, external_id);

CREATE INDEX IF NOT EXISTS idx_telco_inbound_room
  ON telco_inbound_events (project_id, room_id, created_at DESC);
