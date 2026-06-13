-- Slack/Discord bridge (bidirectional message sync)

CREATE TABLE IF NOT EXISTS bridge_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'discord')),
  name TEXT NOT NULL,
  token TEXT,
  webhook_url TEXT,
  bot_user_id TEXT,
  bot_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'rate_limited')),
  settings TEXT,
  last_sync_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_project
  ON bridge_configs (project_id, platform);

CREATE TABLE IF NOT EXISTS bridge_channel_mappings (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  fluxychat_room_id TEXT NOT NULL,
  external_channel_id TEXT NOT NULL,
  external_channel_name TEXT,
  sync_direction TEXT NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('inbound', 'outbound', 'both')),
  sync_reactions INTEGER NOT NULL DEFAULT 1,
  sync_attachments INTEGER NOT NULL DEFAULT 1,
  auto_reply INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_channel_bridge
  ON bridge_channel_mappings (bridge_id);
CREATE INDEX IF NOT EXISTS idx_bridge_channel_room
  ON bridge_channel_mappings (fluxychat_room_id);

CREATE TABLE IF NOT EXISTS bridge_message_map (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  fluxychat_message_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  external_platform TEXT NOT NULL,
  external_channel_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_msg_fc
  ON bridge_message_map (fluxychat_message_id);
CREATE INDEX IF NOT EXISTS idx_bridge_msg_ext
  ON bridge_message_map (external_message_id);
CREATE INDEX IF NOT EXISTS idx_bridge_msg_bridge
  ON bridge_message_map (bridge_id, synced_at DESC);

CREATE TABLE IF NOT EXISTS bridge_events (
  id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('message_sync', 'reaction_sync', 'attachment_sync', 'member_sync', 'channel_sync', 'error', 'connect', 'disconnect')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_event_project
  ON bridge_events (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_event_bridge
  ON bridge_events (bridge_id, recorded_at DESC);
