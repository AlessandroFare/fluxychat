-- FluxyOps: declarative processes. Tenant key is project_id (not a workspaces table).

CREATE TABLE IF NOT EXISTS ops_process_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ops_process_definitions_project
  ON ops_process_definitions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_process_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  definition_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  published_by TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (project_id, definition_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ops_process_versions_status
  ON ops_process_versions (project_id, definition_id, status, version DESC);

CREATE TABLE IF NOT EXISTS ops_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting', 'done', 'failed', 'cancelled')),
  trigger_json TEXT NOT NULL DEFAULT '{}',
  context_json TEXT NOT NULL DEFAULT '{}',
  cost_json TEXT NOT NULL DEFAULT '{}',
  kill_switch INTEGER NOT NULL DEFAULT 0,
  current_step_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_runs_project_status
  ON ops_runs (project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_runs_room
  ON ops_runs (project_id, room_id);

CREATE TABLE IF NOT EXISTS ops_run_steps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting', 'done', 'failed', 'skipped', 'interrupted')),
  attempts INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  error TEXT,
  interrupt_reason TEXT,
  started_at TEXT,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_run_steps_run
  ON ops_run_steps (project_id, run_id, step_id);

CREATE TABLE IF NOT EXISTS ops_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  assignee TEXT,
  role TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'expired', 'cancelled')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_tasks_assignee
  ON ops_tasks (project_id, assignee, status, due_at);

CREATE TABLE IF NOT EXISTS ops_approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  decisions_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'void')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_approvals_run
  ON ops_approvals (project_id, run_id, status);

CREATE TABLE IF NOT EXISTS ops_guests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  email TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '[]',
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_guests_run
  ON ops_guests (project_id, run_id);

CREATE TABLE IF NOT EXISTS ops_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT,
  actor TEXT,
  event_type TEXT NOT NULL,
  input_hash TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_events_run
  ON ops_events (project_id, run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ops_budgets (
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  max_tool_calls INTEGER,
  max_tokens INTEGER,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, run_id)
);

CREATE TABLE IF NOT EXISTS ops_tools (
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  side TEXT NOT NULL CHECK (side IN ('read', 'write')),
  risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  enabled INTEGER NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  data_classes_json TEXT NOT NULL DEFAULT '[]',
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, name)
);

CREATE TABLE IF NOT EXISTS ops_policies (
  project_id TEXT PRIMARY KEY,
  policy_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_builder_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  draft_version_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_builder_sessions_project
  ON ops_builder_sessions (project_id, updated_at DESC);
