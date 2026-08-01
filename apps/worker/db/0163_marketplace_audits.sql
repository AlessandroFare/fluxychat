-- PG-ZB-7: MCP marketplace security scan results (written by CI, read by console)

CREATE TABLE IF NOT EXISTS marketplace_audits (
  server_id TEXT NOT NULL,
  project_id TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  findings_json TEXT,
  severity_critical INTEGER NOT NULL DEFAULT 0,
  severity_high INTEGER NOT NULL DEFAULT 0,
  scanner_version TEXT,
  scanner_name TEXT NOT NULL DEFAULT 'mcp-audit',
  scanned_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, scanned_at)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_audits_server ON marketplace_audits(server_id, scanned_at DESC);
