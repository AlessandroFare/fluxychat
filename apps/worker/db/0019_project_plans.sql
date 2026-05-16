CREATE TABLE IF NOT EXISTS project_plans (
  project_id TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'free',
  billing_status TEXT NOT NULL DEFAULT 'manual',
  message_limit_monthly INTEGER,
  agent_invoke_limit_monthly INTEGER,
  webhook_delivery_limit_monthly INTEGER,
  pricing_version TEXT NOT NULL DEFAULT 'v1',
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_plans_plan_name
  ON project_plans (plan_name, billing_status);
