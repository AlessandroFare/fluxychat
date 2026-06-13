-- P14-D: AI Image Generation in Chat
CREATE TABLE IF NOT EXISTS ai_image_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id TEXT,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  image_url TEXT,
  image_r2_key TEXT,
  image_size TEXT DEFAULT '1024x1024',
  image_quality TEXT DEFAULT 'standard',
  image_style TEXT DEFAULT 'vivid',
  model TEXT DEFAULT 'dall-e-3',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error TEXT,
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_image_gen_project ON ai_image_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_room ON ai_image_generations(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_status ON ai_image_generations(status);
