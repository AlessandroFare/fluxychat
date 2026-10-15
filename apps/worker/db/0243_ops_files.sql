-- File metadata for FluxyOps sources (bytes live in R2 / AI Search).

CREATE TABLE IF NOT EXISTS ops_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_id TEXT,
  key TEXT NOT NULL,
  content_type TEXT,
  text TEXT,
  item_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_files_project
  ON ops_files (project_id, source_id, created_at DESC);
