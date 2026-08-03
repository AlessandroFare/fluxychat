-- #51 Rehearsal Rooms — ephemeral practice rooms cloned from real room context
CREATE TABLE IF NOT EXISTS rehearsal_rooms (
  rehearsal_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_room_id TEXT NOT NULL,
  rehearsal_room_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  agent_id TEXT,
  snapshot_ts TEXT NOT NULL,
  stated_goal TEXT,
  counterparty_role TEXT,
  snapshot_message_count INTEGER NOT NULL DEFAULT 0,
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  expires_at TEXT NOT NULL,
  persist_after_session INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_rooms_project
  ON rehearsal_rooms(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rehearsal_rooms_expires
  ON rehearsal_rooms(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_rehearsal_rooms_rehearsal_room
  ON rehearsal_rooms(rehearsal_room_id);
