-- Share tokens (unguessable; room id is not the URL), HITL tap one-time jti,
-- write-intent payload hash.

CREATE TABLE IF NOT EXISTS room_share_links (
  token TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_share_links_room
  ON room_share_links (room_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS hitl_tap_nonces (
  jti TEXT PRIMARY KEY,
  used_at TEXT NOT NULL
);

ALTER TABLE integration_write_intents ADD COLUMN payload_hash TEXT;
