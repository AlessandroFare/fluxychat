-- Cross-Org Agent Rooms (#32) — neutral host, commitments, bilateral audit

CREATE TABLE IF NOT EXISTS cross_org_rooms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  org_a_id TEXT NOT NULL,
  org_b_id TEXT NOT NULL,
  org_a_agent_id TEXT,
  org_b_agent_id TEXT,
  max_rounds INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_org_rooms_project
  ON cross_org_rooms (project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cross_org_rooms_room
  ON cross_org_rooms (project_id, room_id);

CREATE TABLE IF NOT EXISTS cross_org_agent_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cross_org_room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  public_key_b64 TEXT NOT NULL,
  capabilities_json TEXT,
  card_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cross_org_agent_identity
  ON cross_org_agent_identities (cross_org_room_id, org_id, agent_id);

CREATE TABLE IF NOT EXISTS cross_org_commitments (
  id TEXT PRIMARY KEY,
  cross_org_room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  proposed_by_org TEXT NOT NULL,
  proposed_by_agent TEXT,
  terms_json TEXT NOT NULL,
  state TEXT NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  expires_at TEXT,
  human_a_confirmed_at TEXT,
  human_b_confirmed_at TEXT,
  parent_commitment_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_org_commitments_room_state
  ON cross_org_commitments (cross_org_room_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS cross_org_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cross_org_room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  event_json TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_org_audit_room
  ON cross_org_audit_log (cross_org_room_id, id ASC);
