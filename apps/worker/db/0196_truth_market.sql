-- #50 Truth Market — stake on verifiable AI claims (internal credits MVP)

CREATE TABLE IF NOT EXISTS truth_credits (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS truth_claims (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  agent_id TEXT,
  content TEXT NOT NULL,
  staked_by_user_id TEXT NOT NULL,
  stake_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'credits',
  ttl_seconds INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_truth_claims_project_room
  ON truth_claims (project_id, room_id, state);

CREATE INDEX IF NOT EXISTS idx_truth_claims_expires
  ON truth_claims (state, expires_at);

CREATE TABLE IF NOT EXISTS truth_disputes (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  disputed_by_user_id TEXT NOT NULL,
  evidence TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  resolved_by_user_id TEXT,
  outcome TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_truth_disputes_claim
  ON truth_disputes (claim_id, state);

CREATE INDEX IF NOT EXISTS idx_truth_disputes_project
  ON truth_disputes (project_id, state);
