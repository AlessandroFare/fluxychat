-- P15-I: Multimodal AI
CREATE TABLE IF NOT EXISTS multimodal_analyses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  media_url TEXT,
  analysis_result TEXT NOT NULL DEFAULT '{}',
  ai_model TEXT,
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_multimodal_project ON multimodal_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_message ON multimodal_analyses(message_id);
