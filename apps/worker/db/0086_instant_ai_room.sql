-- P15-H: Instant AI Room
CREATE TABLE IF NOT EXISTS ai_room_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'support',
  agent_name TEXT NOT NULL DEFAULT 'AI Assistant',
  agent_avatar_url TEXT,
  agent_system_prompt TEXT,
  agent_model TEXT DEFAULT 'gpt-4o-mini',
  welcome_message TEXT,
  response_style TEXT DEFAULT 'professional',
  allowed_topics TEXT NOT NULL DEFAULT '[]',
  escalation_threshold REAL DEFAULT 0.7,
  auto_resolve_minutes INTEGER DEFAULT 30,
  embed_enabled INTEGER NOT NULL DEFAULT 1,
  embed_position TEXT DEFAULT 'bottom-right',
  embed_color TEXT DEFAULT '#0066ff',
  embed_title TEXT DEFAULT 'Chat with us',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_room_configs_project ON ai_room_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_room_configs_room ON ai_room_configs(room_id);
