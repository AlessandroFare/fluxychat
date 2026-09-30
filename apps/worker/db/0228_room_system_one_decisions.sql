-- Room Decisions audit (System One / deterministic). Not message_decisions quorum.

CREATE TABLE IF NOT EXISTS room_system_one_decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'shadow',
  model TEXT,
  model_version TEXT,
  choice TEXT,
  options_json TEXT,
  probabilities_json TEXT,
  noul REAL,
  margin REAL,
  cascaded_from TEXT,
  two_key INTEGER NOT NULL DEFAULT 0,
  run_id TEXT,
  agent_id TEXT,
  tool_name TEXT,
  hitl_request_id TEXT,
  human_outcome TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_s1_decisions_room
  ON room_system_one_decisions (project_id, room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_s1_decisions_hitl
  ON room_system_one_decisions (hitl_request_id)
  WHERE hitl_request_id IS NOT NULL;
