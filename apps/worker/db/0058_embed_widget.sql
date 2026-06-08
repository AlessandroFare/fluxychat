-- P12-A: Embeddable chat widget (per-project config)

CREATE TABLE IF NOT EXISTS project_embed_configs (
  project_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  default_room_id TEXT,
  allowed_origins TEXT,
  z_index INTEGER NOT NULL DEFAULT 2147483000,
  launcher_title TEXT,
  theme_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_embed_configs_enabled
  ON project_embed_configs (enabled, updated_at DESC);
