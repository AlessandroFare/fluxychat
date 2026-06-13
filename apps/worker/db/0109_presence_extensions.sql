-- Collaborative presence primitives: cursors, focus, shared context

CREATE TABLE IF NOT EXISTS presence_extensions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  presence_type TEXT NOT NULL CHECK (presence_type IN ('cursor', 'focus', 'scroll', 'selection', 'viewing')),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_presence_room_type
  ON presence_extensions (room_id, presence_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_user
  ON presence_extensions (user_id, room_id, presence_type);

CREATE INDEX IF NOT EXISTS idx_presence_expires
  ON presence_extensions (expires_at) WHERE expires_at IS NOT NULL;
