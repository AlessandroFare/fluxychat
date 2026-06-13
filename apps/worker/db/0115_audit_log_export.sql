-- Audit log streaming and SIEM integration

CREATE TABLE IF NOT EXISTS audit_export_schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  format TEXT NOT NULL DEFAULT 'json',
  filter_actor TEXT,
  filter_action TEXT,
  filter_resource TEXT,
  filter_severity TEXT,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('webhook', 'siem', 'email')),
  destination_url TEXT,
  destination_config TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_schedule_project
  ON audit_export_schedules (project_id, enabled);

CREATE TABLE IF NOT EXISTS audit_export_runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  event_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_run_project
  ON audit_export_runs (project_id, started_at DESC);
