-- Basic operational metrics counters (minute buckets)

CREATE TABLE IF NOT EXISTS operational_metrics (
  id TEXT PRIMARY KEY,                 -- metric|project|bucketMinute
  metric_name TEXT NOT NULL,           -- requests_total, requests_error, webhook_delivery_failed, agent_runs_failed, messages_created
  project_id TEXT NOT NULL,
  bucket_minute TEXT NOT NULL,         -- ISO minute: YYYY-MM-DDTHH:MM
  metric_value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_metrics_lookup
  ON operational_metrics (project_id, metric_name, bucket_minute DESC);

