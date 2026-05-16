-- Persistent audit trail for admin/moderation critical actions

CREATE TABLE IF NOT EXISTS operational_audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_roles TEXT NOT NULL, -- comma-separated
  action TEXT NOT NULL, -- e.g. admin.mute, admin.project.create
  target_type TEXT, -- project|room|user|webhook|alert_rule|webhook_delivery
  target_id TEXT,
  trace_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_audit_events_project_created
  ON operational_audit_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_events_action_created
  ON operational_audit_events (action, created_at DESC);

