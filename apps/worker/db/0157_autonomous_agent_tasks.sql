-- Long-horizon autonomous agent tasks (A2A / Agent Steward pattern)

CREATE TABLE IF NOT EXISTS agent_autonomous_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'submitted', 'working', 'input-required', 'completed', 'failed', 'cancelled'
  )),
  input TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  task_offset INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  parent_task_id TEXT,
  artifacts_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT,
  error TEXT,
  resume_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_auto_tasks_idem
  ON agent_autonomous_tasks (project_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_agent_auto_tasks_room
  ON agent_autonomous_tasks (project_id, room_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_auto_tasks_agent
  ON agent_autonomous_tasks (project_id, to_agent_id, status, updated_at DESC);
