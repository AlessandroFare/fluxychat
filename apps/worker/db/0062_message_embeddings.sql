-- P15-F: AI Semantic Search
-- Stores vector embeddings for semantic search over chat messages.
CREATE TABLE IF NOT EXISTS message_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL DEFAULT 'default',
  room_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  embedding TEXT NOT NULL,          -- JSON array of floats, e.g. "[0.1, 0.2, ...]"
  model TEXT NOT NULL,              -- embedding model used, e.g. "openai/text-embedding-3-small"
  dimensions INTEGER NOT NULL,      -- number of dimensions in the vector
  created_at TEXT NOT NULL,
  UNIQUE(project_id, room_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_emb_project_room ON message_embeddings(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_msg_emb_message ON message_embeddings(message_id);
CREATE INDEX IF NOT EXISTS idx_msg_emb_hash ON message_embeddings(content_hash);
