-- P12-G: Custom domain white-label (hostname → project)

CREATE TABLE IF NOT EXISTS project_custom_domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  hostname TEXT NOT NULL,
  default_room_id TEXT,
  brand_name TEXT,
  brand_logo_url TEXT,
  allowed_origins TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_custom_domains_hostname
  ON project_custom_domains (hostname);

CREATE INDEX IF NOT EXISTS idx_project_custom_domains_project
  ON project_custom_domains (project_id, status, updated_at DESC);
