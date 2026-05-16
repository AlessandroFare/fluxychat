-- Data retention policies per project
-- Controls automatic cleanup of old data based on configurable retention periods

CREATE TABLE IF NOT EXISTS data_retention_policies (
  project_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 90,
  auto_purge INTEGER NOT NULL DEFAULT 0,
  last_purged_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, data_type),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Seed a special project row to hold global defaults.
-- This avoids FK failures while keeping per-project policies constrained.
INSERT OR IGNORE INTO projects (id, name, created_at)
VALUES ('__default', '__default', datetime('now'));

INSERT OR IGNORE INTO data_retention_policies (project_id, data_type, retention_days, auto_purge, updated_at) VALUES
  ('__default', 'messages', 365, 1, datetime('now')),
  ('__default', 'audit_events', 90, 1, datetime('now')),
  ('__default', 'agent_runs', 180, 1, datetime('now')),
  ('__default', 'usage_monthly', 730, 1, datetime('now')),
  ('__default', 'webhook_deliveries', 30, 1, datetime('now'));
