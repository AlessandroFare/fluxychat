-- Multi-Agent Debate UX (#45) — configurable perspective roles + session log

CREATE TABLE IF NOT EXISTS debate_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  trigger_pattern TEXT,
  role_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  max_rounds INTEGER NOT NULL DEFAULT 2,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_debate_roles_project
  ON debate_roles (project_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS debate_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  max_rounds INTEGER NOT NULL DEFAULT 2,
  current_round INTEGER NOT NULL DEFAULT 0,
  steps_json TEXT,
  synthesis_content TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_debate_sessions_project_room
  ON debate_sessions (project_id, room_id, created_at DESC);
