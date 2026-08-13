-- CP-071: Durable WorkflowAgent state (resume after Worker restart)

CREATE TABLE IF NOT EXISTS agent_durable_workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_durable_workflows_project_status
  ON agent_durable_workflows (project_id, status, updated_at DESC);
