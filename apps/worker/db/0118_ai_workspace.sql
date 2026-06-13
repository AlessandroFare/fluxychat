-- AI Workspace: unified room = chat + knowledge + tasks + files + agent

CREATE TABLE IF NOT EXISTS workspace_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  tabs TEXT NOT NULL DEFAULT '["chat","tasks","files"]',
  agent_id TEXT,
  knowledge_scope TEXT DEFAULT 'room',
  settings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_project
  ON workspace_configs (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_room
  ON workspace_configs (project_id, room_id);

CREATE TABLE IF NOT EXISTS workspace_tabs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tab_type TEXT NOT NULL CHECK (tab_type IN ('chat', 'knowledge', 'tasks', 'files', 'agent', 'custom')),
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_tabs
  ON workspace_tabs (workspace_id, sort_order);

CREATE TABLE IF NOT EXISTS workspace_pins (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('message', 'task', 'file', 'knowledge', 'agent_output')),
  item_id TEXT NOT NULL,
  pinned_by TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_pins
  ON workspace_pins (workspace_id, item_type);

CREATE TABLE IF NOT EXISTS workspace_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tabs TEXT NOT NULL DEFAULT '["chat","tasks","files"]',
  agent_config TEXT,
  settings TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_template_project
  ON workspace_templates (project_id, is_system);
