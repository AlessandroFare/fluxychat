-- A2A agent cards, tasks, and envelopes (roadmap #24)

CREATE TABLE IF NOT EXISTS a2a_agent_cards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  capabilities_json TEXT,
  endpoint_url TEXT,
  health_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a2a_agent_cards_project_agent
  ON a2a_agent_cards (project_id, agent_id);

CREATE TABLE IF NOT EXISTS a2a_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL,
  source_agent_id TEXT,
  target_agent_id TEXT,
  artifacts_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_a2a_tasks_project_created
  ON a2a_tasks (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS a2a_envelopes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,
  extensions_json TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_a2a_envelopes_target_pending
  ON a2a_envelopes (project_id, target_agent_id, delivered, created_at DESC);
