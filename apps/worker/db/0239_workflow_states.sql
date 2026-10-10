CREATE TABLE IF NOT EXISTS workflow_states (
  project_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, scope, scope_id, key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_states_expiry
  ON workflow_states (expires_at);
