-- CP-070: Policy-as-code for agent tool approval (JSON rules per project)

CREATE TABLE IF NOT EXISTS project_agent_tool_policies (
  project_id TEXT PRIMARY KEY,
  policy_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_tool_policy_audit (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  effect TEXT NOT NULL,
  rule_id TEXT,
  run_id TEXT,
  room_id TEXT,
  user_id TEXT,
  input_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_policy_audit_project
  ON agent_tool_policy_audit (project_id, created_at DESC);
