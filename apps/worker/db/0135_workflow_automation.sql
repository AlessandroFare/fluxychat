-- No-code Workflow Automation
-- 0121 workflow_builder created overlapping tables; rename before expanded automation schema.

ALTER TABLE workflow_definitions RENAME TO workflow_builder_definitions;
ALTER TABLE workflow_runs RENAME TO workflow_builder_runs;
ALTER TABLE workflow_templates RENAME TO workflow_builder_templates;

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('message', 'event', 'schedule', 'webhook', 'user_join', 'user_leave', 'room_create', 'room_update', 'ai_response', 'manual')),
  trigger_config TEXT,
  actions TEXT NOT NULL,
  conditions TEXT,
  error_handling TEXT DEFAULT 'stop' CHECK (error_handling IN ('stop', 'continue', 'retry')),
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  last_error TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wf_def_project
  ON workflow_definitions (project_id, status);
CREATE INDEX IF NOT EXISTS idx_wf_def_trigger
  ON workflow_definitions (trigger_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_def_name
  ON workflow_definitions (project_id, name);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'timeout')),
  trigger_data TEXT,
  context TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wf_exec_workflow
  ON workflow_executions (workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wf_exec_project
  ON workflow_executions (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wf_exec_status
  ON workflow_executions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_config TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input TEXT,
  output TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wf_step_execution
  ON workflow_execution_steps (execution_id, step_index ASC);
CREATE INDEX IF NOT EXISTS idx_wf_step_status
  ON workflow_execution_steps (status, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('notification', 'automation', 'integration', 'moderation', 'analytics', 'custom')),
  trigger_type TEXT NOT NULL,
  actions TEXT NOT NULL,
  conditions TEXT,
  is_official INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wf_tpl_category
  ON workflow_templates (category, is_official DESC);
CREATE INDEX IF NOT EXISTS idx_wf_tpl_project
  ON workflow_templates (project_id, use_count DESC);

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'interval', 'cron')),
  interval_ms INTEGER,
  cron_expression TEXT,
  next_run_at TEXT,
  last_run_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wf_sched_workflow
  ON workflow_schedules (workflow_id, enabled);
CREATE INDEX IF NOT EXISTS idx_wf_sched_next
  ON workflow_schedules (next_run_at, enabled);
