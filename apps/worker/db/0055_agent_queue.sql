-- P13-T4: Agent task queue lite (claim room, SLA timer, assignee)

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 0,
  assignee_user_id TEXT,
  claimed_at TEXT,
  sla_due_at TEXT NOT NULL,
  resolved_at TEXT,
  disposition TEXT,
  note TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_project_status
  ON agent_tasks (project_id, status, sla_due_at ASC);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_assignee
  ON agent_tasks (project_id, assignee_user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tasks_room_active
  ON agent_tasks (project_id, room_id)
  WHERE status IN ('open', 'claimed');
