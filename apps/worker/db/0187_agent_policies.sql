-- Ambient agents (#38) — event-driven agent policies + audit runs

CREATE TABLE IF NOT EXISTS agent_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  room_id TEXT,
  max_autonomy TEXT NOT NULL DEFAULT 'notify',
  prompt_template TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_policies_project
  ON agent_policies (project_id, enabled, trigger_type);

CREATE TABLE IF NOT EXISTS agent_policy_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_payload_json TEXT,
  room_id TEXT,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  autonomy_level TEXT NOT NULL,
  run_id TEXT,
  message_id INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_policy_runs_project
  ON agent_policy_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_policy_runs_policy
  ON agent_policy_runs (policy_id, created_at DESC);
