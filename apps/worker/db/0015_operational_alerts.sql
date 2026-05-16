-- Alerting primitives for operational metrics

CREATE TABLE IF NOT EXISTS operational_alert_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 5,
  threshold_value INTEGER NOT NULL,
  comparator TEXT NOT NULL DEFAULT 'gte', -- gte | gt
  severity TEXT NOT NULL DEFAULT 'warning', -- warning | critical
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_alert_rules_project_enabled
  ON operational_alert_rules (project_id, enabled, metric_name);

CREATE TABLE IF NOT EXISTS operational_alert_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  observed_value INTEGER NOT NULL,
  threshold_value INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_alert_events_project_created
  ON operational_alert_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_alert_events_rule_status
  ON operational_alert_events (rule_id, status, created_at DESC);

