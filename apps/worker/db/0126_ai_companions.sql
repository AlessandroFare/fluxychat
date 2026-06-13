-- AI Companions (persistent AI personas in rooms)

CREATE TABLE IF NOT EXISTS ai_companions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  system_prompt TEXT NOT NULL,
  personality TEXT,
  skills TEXT,
  trigger_mode TEXT NOT NULL DEFAULT 'mention' CHECK (trigger_mode IN ('mention', 'keyword', 'always', 'schedule', 'silent')),
  trigger_keywords TEXT,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_project
  ON ai_companions (project_id, status);

CREATE TABLE IF NOT EXISTS ai_companion_rooms (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  join_message TEXT,
  leave_message TEXT,
  custom_prompt_override TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_room_companion
  ON ai_companion_rooms (companion_id);
CREATE INDEX IF NOT EXISTS idx_companion_room_room
  ON ai_companion_rooms (room_id);

CREATE TABLE IF NOT EXISTS ai_companion_interactions (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  tokens_used INTEGER,
  latency_ms INTEGER,
  triggered_by TEXT CHECK (triggered_by IN ('mention', 'keyword', 'schedule', 'always', 'manual')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_interaction_companion
  ON ai_companion_interactions (companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_interaction_room
  ON ai_companion_interactions (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_interaction_project
  ON ai_companion_interactions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_companion_memory (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT,
  memory_type TEXT NOT NULL DEFAULT 'conversation' CHECK (memory_type IN ('conversation', 'fact', 'preference', 'summary', 'instruction')),
  content TEXT NOT NULL,
  source TEXT,
  importance REAL DEFAULT 0.5,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_memory_companion
  ON ai_companion_memory (companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_memory_room
  ON ai_companion_memory (room_id, importance DESC);
