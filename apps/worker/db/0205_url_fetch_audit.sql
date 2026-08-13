-- CP-072: Audit log for outbound URL fetches (OG preview, enrichment)

CREATE TABLE IF NOT EXISTS url_fetch_audit (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  feature TEXT NOT NULL,
  url TEXT NOT NULL,
  outcome TEXT NOT NULL,
  blocked_reason TEXT,
  http_status INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_url_fetch_audit_project
  ON url_fetch_audit (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_url_fetch_audit_feature
  ON url_fetch_audit (feature, created_at DESC);
