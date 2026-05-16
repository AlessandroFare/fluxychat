-- Multi-tenancy: projects, api keys, and project scoping

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, -- project id (e.g. uuid or slug)
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, -- public API key id
  project_id TEXT NOT NULL,
  secret TEXT NOT NULL, -- stored as-is for now; can be hashed later
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_project
  ON api_keys (project_id);

-- Add project_id to existing tables, defaulting to "default"

ALTER TABLE messages
  ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE moderation_events
  ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE automation_events
  ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE message_reactions
  ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE read_receipts
  ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';


