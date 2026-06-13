-- OpenTelemetry export configuration and queued exports

CREATE TABLE IF NOT EXISTS otel_export_config (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('traces', 'metrics', 'logs', 'all')),
  auth_header TEXT,
  headers_json TEXT,
  batch_size INTEGER NOT NULL DEFAULT 100,
  flush_interval_seconds INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otel_config_project
  ON otel_export_config (project_id, enabled);

CREATE TABLE IF NOT EXISTS otel_export_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  payload_type TEXT NOT NULL CHECK (payload_type IN ('trace', 'metric', 'log')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_otel_queue_status
  ON otel_export_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_otel_queue_config
  ON otel_export_queue (config_id, status);
