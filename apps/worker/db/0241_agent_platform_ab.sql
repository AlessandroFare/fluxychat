-- Agent Platform A/B tests. Counters live on variants_json, not a stats warehouse.

CREATE TABLE IF NOT EXISTS agent_platform_ab_tests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL DEFAULT 'satisfaction_score',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  variants_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_platform_ab_tests_project
  ON agent_platform_ab_tests (project_id, updated_at DESC);
