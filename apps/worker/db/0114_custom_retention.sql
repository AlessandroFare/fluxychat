-- Custom retention policies per data type and room

CREATE TABLE IF NOT EXISTS custom_retention_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('messages', 'events', 'audit_logs', 'presences', 'files', 'notifications', 'threads', 'reactions')),
  room_id TEXT,
  retention_days INTEGER NOT NULL DEFAULT 90,
  auto_purge INTEGER NOT NULL DEFAULT 0,
  archive_before_delete INTEGER NOT NULL DEFAULT 0,
  archive_bucket TEXT,
  require_approval INTEGER NOT NULL DEFAULT 0,
  notify_before_days INTEGER NOT NULL DEFAULT 7,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_purged_at TEXT,
  next_purge_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_retention_project
  ON custom_retention_policies (project_id, enabled);
CREATE INDEX IF NOT EXISTS idx_custom_retention_room
  ON custom_retention_policies (room_id, data_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_retention_unique
  ON custom_retention_policies (project_id, data_type, room_id);

CREATE TABLE IF NOT EXISTS retention_purge_log (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  room_id TEXT,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  archived_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_purge_log_project
  ON retention_purge_log (project_id, started_at DESC);
