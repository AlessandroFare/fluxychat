-- P12-H: Per-room AI → human handoff state

CREATE TABLE IF NOT EXISTS room_handoffs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'human_active',
  agent_task_id TEXT,
  handed_off_by_user_id TEXT NOT NULL,
  handed_off_at TEXT NOT NULL,
  context_summary TEXT,
  disposition TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_handoffs_project_room
  ON room_handoffs (project_id, room_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_handoffs_active
  ON room_handoffs (project_id, room_id)
  WHERE status = 'human_active';
