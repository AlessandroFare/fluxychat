-- Agent Platform token spend ledger (not Stripe invoices).

CREATE TABLE IF NOT EXISTS agent_platform_costs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agent_platform_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_platform_costs_agent
  ON agent_platform_costs (project_id, agent_id, created_at DESC);
