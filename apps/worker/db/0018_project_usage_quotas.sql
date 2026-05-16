-- Monthly usage buckets for plan/quotas enforcement

CREATE TABLE IF NOT EXISTS project_usage_monthly (
  id TEXT PRIMARY KEY, -- `${project_id}|${month_key}|${metric_name}`
  project_id TEXT NOT NULL,
  month_key TEXT NOT NULL, -- YYYY-MM
  metric_name TEXT NOT NULL, -- messages_created | agent_invokes | webhook_deliveries
  used_value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_usage_monthly_project_month
  ON project_usage_monthly (project_id, month_key, metric_name);

