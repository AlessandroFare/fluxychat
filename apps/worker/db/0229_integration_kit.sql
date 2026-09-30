-- Integration kit: entity rooms, encrypted connection secrets, webhook idempotency, write intents.
-- Not Marketplace OAuth apps. Operator HMAC + optional env PATs for GitHub/Linear/Jira writes.

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  kill_switch INTEGER NOT NULL DEFAULT 0,
  no_train INTEGER NOT NULL DEFAULT 0,
  signing_ciphertext TEXT,
  signing_iv TEXT,
  signing_plain TEXT,
  token_ciphertext TEXT,
  token_iv TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, provider)
);

CREATE TABLE IF NOT EXISTS entity_room_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, provider, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_room_links_room
  ON entity_room_links (project_id, room_id);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, provider, delivery_key)
);

CREATE TABLE IF NOT EXISTS integration_write_intents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  preview_json TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  agent_id TEXT,
  error TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_write_intents_room
  ON integration_write_intents (project_id, room_id, created_at);
