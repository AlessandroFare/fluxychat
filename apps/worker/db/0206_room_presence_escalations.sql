-- PH-102: presence-aware escalation watches per room
CREATE TABLE IF NOT EXISTS room_presence_escalations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting'
    CHECK (status IN ('awaiting', 'resolved', 'cancelled')),
  awaiting_user_id TEXT,
  escalation_chain_json TEXT NOT NULL,
  current_tier_index INTEGER NOT NULL DEFAULT 0,
  nudge_interval_seconds INTEGER NOT NULL DEFAULT 300,
  awaiting_response_since TEXT NOT NULL,
  last_nudge_at TEXT,
  last_nudged_user_id TEXT,
  resolved_at TEXT,
  resolved_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_presence_esc_active
  ON room_presence_escalations (project_id, room_id)
  WHERE status = 'awaiting';

CREATE INDEX IF NOT EXISTS idx_room_presence_esc_awaiting
  ON room_presence_escalations (status, awaiting_response_since);
