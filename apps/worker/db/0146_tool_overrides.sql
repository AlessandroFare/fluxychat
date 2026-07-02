-- P22-D4: Tool Override System
-- Stores per-profile tool customization (description, title, needsApproval, enabled).

CREATE TABLE IF NOT EXISTS tool_overrides (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  overrides_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_overrides_project_profile
  ON tool_overrides (project_id, profile_id);
