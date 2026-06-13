-- P17-J: Rich Message Previews + Formatting
-- Link preview cache, file type metadata, message formatting

CREATE TABLE IF NOT EXISTS link_previews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  content_type TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_link_previews_project_url ON link_previews(project_id, url);
CREATE INDEX IF NOT EXISTS idx_link_previews_expires ON link_previews(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_formatting_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_formatting_rules_project ON message_formatting_rules(project_id, enabled);
