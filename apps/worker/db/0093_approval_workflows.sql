-- P20-B: Realtime Approval Workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'single',
  required_approvals INTEGER NOT NULL DEFAULT 1,
  required_roles TEXT NOT NULL DEFAULT '["owner","admin"]',
  sla_minutes INTEGER DEFAULT 60,
  auto_approve_after_sla INTEGER NOT NULL DEFAULT 0,
  notify_on_request INTEGER NOT NULL DEFAULT 1,
  notify_on_decision INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_project ON approval_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_room ON approval_workflows(room_id);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  context_type TEXT,
  context_id TEXT,
  context_data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT,
  decided_by TEXT,
  decided_at TEXT,
  sla_due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow ON approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_room ON approval_requests(room_id);

CREATE TABLE IF NOT EXISTS approval_votes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  comment TEXT,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES approval_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_votes_request ON approval_votes(request_id);
