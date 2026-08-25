-- Inbound email → room / agent (CF-A-031). Idempotent on RFC Message-ID.

CREATE TABLE IF NOT EXISTS email_inbound_routes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  address TEXT NOT NULL,
  room_id TEXT,
  agent_id TEXT,
  mode TEXT NOT NULL DEFAULT 'room' CHECK (mode IN ('room', 'agent', 'both')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inbound_routes_addr
  ON email_inbound_routes (project_id, address);

CREATE TABLE IF NOT EXISTS email_inbound_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  message_id_hdr TEXT NOT NULL,
  from_addr TEXT,
  to_addr TEXT,
  room_id TEXT,
  user_id TEXT,
  fluxy_message_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inbound_events_msgid
  ON email_inbound_events (project_id, message_id_hdr);
