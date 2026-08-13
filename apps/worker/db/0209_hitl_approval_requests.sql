-- HITL approval requests with chain snapshot (immutable per request).
CREATE TABLE IF NOT EXISTS hitl_approval_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input_json TEXT NOT NULL DEFAULT '{}',
  run_id TEXT,
  agent_id TEXT,
  requester_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  approval_chain_snapshot_json TEXT NOT NULL DEFAULT '[]',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  current_approver_id TEXT,
  started_at TEXT NOT NULL,
  expires_at TEXT,
  decided_at TEXT,
  decided_by TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hitl_approval_pending_approver
  ON hitl_approval_requests (project_id, current_approver_id, status, started_at ASC);

CREATE INDEX IF NOT EXISTS idx_hitl_approval_room_status
  ON hitl_approval_requests (project_id, room_id, status, started_at DESC);
