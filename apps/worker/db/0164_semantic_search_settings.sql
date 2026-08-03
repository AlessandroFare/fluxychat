-- Per-project semantic search settings (P15-F productization)

CREATE TABLE IF NOT EXISTS project_semantic_search (
  project_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_embed INTEGER NOT NULL DEFAULT 1,
  default_mode TEXT NOT NULL DEFAULT 'hybrid'
    CHECK (default_mode IN ('keyword', 'hybrid', 'semantic')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_semantic_search_enabled
  ON project_semantic_search (project_id, enabled);
