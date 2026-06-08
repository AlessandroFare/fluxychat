-- P10: Sent.dm delivery tracking + pinned messages (Sendbird-style)

CREATE TABLE IF NOT EXISTS sent_dm_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  fluxy_message_id INTEGER,
  user_id TEXT NOT NULL,
  to_e164 TEXT NOT NULL,
  sent_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  channel TEXT NOT NULL DEFAULT 'sms',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sent_dm_project_status
  ON sent_dm_deliveries (project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sent_dm_sent_message_id
  ON sent_dm_deliveries (sent_message_id);

ALTER TABLE rooms ADD COLUMN pinned_message_id INTEGER;
ALTER TABLE rooms ADD COLUMN pinned_at TEXT;
ALTER TABLE rooms ADD COLUMN pinned_by_user_id TEXT;
