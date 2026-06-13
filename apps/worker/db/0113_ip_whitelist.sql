-- IP Whitelisting per project

CREATE TABLE IF NOT EXISTS project_ip_whitelist (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  cidr_prefix INTEGER,
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_project
  ON project_ip_whitelist (project_id, enabled);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_whitelist_unique
  ON project_ip_whitelist (project_id, ip_address, cidr_prefix);
