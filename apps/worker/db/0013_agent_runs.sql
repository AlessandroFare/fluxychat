-- Track AI agent invocations and usage stats

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  room_id TEXT,
  status TEXT NOT NULL, -- queued | completed | failed
  latency_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_project_created
  ON agent_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_created
  ON agent_runs (agent_id, created_at DESC);

