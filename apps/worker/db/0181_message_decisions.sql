-- #52 Async Decision Quorum — binding acks with role-weighted quorum

CREATE TABLE IF NOT EXISTS message_decisions (
  message_id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  content TEXT NOT NULL,
  required_roles_json TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL DEFAULT 172800,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_message_decisions_room
  ON message_decisions (project_id, room_id, state);

CREATE INDEX IF NOT EXISTS idx_message_decisions_expires
  ON message_decisions (state, expires_at);

CREATE TABLE IF NOT EXISTS message_decision_acks (
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  acked_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_decision_acks_message
  ON message_decision_acks (message_id);
