-- P15-E: AI Memory Layer per Room
-- Stores persistent memory entries extracted from conversations.

CREATE TABLE IF NOT EXISTS room_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('decision', 'faq', 'task', 'user_context', 'sentiment', 'key_fact')),
  content TEXT NOT NULL,
  source_message_ids TEXT,  -- JSON array of message IDs that contributed
  confidence REAL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT  -- optional TTL for ephemeral memory
);

CREATE INDEX IF NOT EXISTS idx_room_memory_project_room ON room_memory(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_memory_kind ON room_memory(project_id, room_id, kind);
CREATE INDEX IF NOT EXISTS idx_room_memory_updated ON room_memory(project_id, room_id, updated_at DESC);
