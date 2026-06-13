-- DLP provider integrations (external DLP services)

CREATE TABLE IF NOT EXISTS dlp_integrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('microsoft_purview', 'symantec', 'forcepoint', ' DigitalGuardian', 'custom_webhook')),
  endpoint_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  config TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_scan_at TEXT,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dlp_integration_project
  ON dlp_integrations (project_id, enabled);

CREATE TABLE IF NOT EXISTS dlp_integration_scans (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  message_id TEXT,
  room_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  verdict TEXT CHECK (verdict IN ('clean', 'violation', 'review', 'error')),
  violations TEXT,
  response_code INTEGER,
  latency_ms INTEGER,
  scanned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dlp_scan_project
  ON dlp_integration_scans (project_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlp_scan_integration
  ON dlp_integration_scans (integration_id, scanned_at DESC);
