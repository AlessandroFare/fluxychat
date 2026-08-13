-- Starter kit template registry (semver names + audit badge metadata).

CREATE TABLE IF NOT EXISTS template_registry (
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'starter',
  repo_url TEXT,
  last_commit_at TEXT,
  last_audited_at INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_registry_id
  ON template_registry (template_id, updated_at DESC);
