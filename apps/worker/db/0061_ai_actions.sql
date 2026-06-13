-- P16-D: AI Actions Hub
-- Configurable actions that agents can execute (tickets, emails, webhooks, etc.)

CREATE TABLE IF NOT EXISTS ai_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('webhook', 'email', 'ticket', 'github_issue', 'custom')),
  config TEXT NOT NULL,  -- JSON: { url, method, headers, template, to, subject, body, ... }
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_project ON ai_actions(project_id, enabled);

CREATE TABLE IF NOT EXISTS ai_action_executions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  room_id TEXT,
  user_id TEXT,
  input TEXT,   -- JSON: arguments from the agent
  output TEXT,  -- JSON: result from the action
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_action_exec_project ON ai_action_executions(project_id, action_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_exec_status ON ai_action_executions(project_id, status);
