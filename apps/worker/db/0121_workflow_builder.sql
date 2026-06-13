-- Workflow Builder: no-code automation

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('message', 'join', 'keyword', 'schedule', 'webhook', 'reaction', 'mention')),
  trigger_config TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_project
  ON workflow_definitions (project_id, enabled);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  trigger_data TEXT,
  result TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_project
  ON workflow_runs (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_run_workflow
  ON workflow_runs (workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  trigger_type TEXT NOT NULL,
  trigger_config TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  use_count INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_template_project
  ON workflow_templates (project_id, is_system);
