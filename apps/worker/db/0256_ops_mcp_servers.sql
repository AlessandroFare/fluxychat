-- Ops MCP gateway: project registry of external MCP servers the governed ops
-- layer may call. Bearer secrets are encrypted with
-- WEBHOOK_SECRET_ENCRYPTION_KEY (secret_ciphertext/secret_iv, same as webhooks).
CREATE TABLE IF NOT EXISTS ops_mcp_servers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_ciphertext TEXT,
  secret_iv TEXT,
  allowed_tools_json TEXT NOT NULL DEFAULT '[]',
  discovered_tools_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_mcp_servers_name
  ON ops_mcp_servers (project_id, name);
