-- Matrix bridge (bidirectional sync with Matrix protocol)

CREATE TABLE IF NOT EXISTS matrix_bridge_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  homeserver_url TEXT NOT NULL,
  access_token TEXT,
  bot_user_id TEXT,
  bot_display_name TEXT,
  sync_mode TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_mode IN ('inbound', 'outbound', 'bidirectional')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  settings TEXT,
  last_sync_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matrix_bridge_project
  ON matrix_bridge_configs (project_id);

CREATE TABLE IF NOT EXISTS matrix_room_mappings (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  fluxychat_room_id TEXT NOT NULL,
  matrix_room_id TEXT NOT NULL,
  matrix_space_id TEXT,
  sync_reactions INTEGER NOT NULL DEFAULT 1,
  sync_attachments INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matrix_mapping_bridge
  ON matrix_room_mappings (bridge_id);
CREATE INDEX IF NOT EXISTS idx_matrix_mapping_fc_room
  ON matrix_room_mappings (fluxychat_room_id);
CREATE INDEX IF NOT EXISTS idx_matrix_mapping_matrix_room
  ON matrix_room_mappings (matrix_room_id);

CREATE TABLE IF NOT EXISTS matrix_message_map (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  fluxychat_message_id TEXT NOT NULL,
  matrix_event_id TEXT NOT NULL,
  matrix_room_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matrix_msg_fc
  ON matrix_message_map (fluxychat_message_id);
CREATE INDEX IF NOT EXISTS idx_matrix_msg_matrix
  ON matrix_message_map (matrix_event_id);
CREATE INDEX IF NOT EXISTS idx_matrix_msg_bridge
  ON matrix_message_map (bridge_id, synced_at DESC);

CREATE TABLE IF NOT EXISTS matrix_sync_log (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'reaction', 'membership', 'power_level', 'space', 'error')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matrix_log_project
  ON matrix_sync_log (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_matrix_log_bridge
  ON matrix_sync_log (bridge_id, recorded_at DESC);
