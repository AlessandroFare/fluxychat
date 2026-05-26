CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_project
  ON message_templates (project_id, updated_at DESC);
