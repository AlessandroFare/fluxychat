-- P17-D: Unified Omnichannel Inbox — channel abstraction + routing

CREATE TABLE IF NOT EXISTS channel_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('chat', 'email', 'sms', 'whatsapp', 'telegram', 'slack', 'discord', 'webhook', 'custom')),
  channel_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  settings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_configs_project
  ON channel_configs (project_id, channel_type);

CREATE TABLE IF NOT EXISTS channel_routing_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  channel_config_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  match_pattern TEXT,
  target_room_id TEXT,
  target_room_pattern TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (channel_config_id) REFERENCES channel_configs(id)
);

CREATE INDEX IF NOT EXISTS idx_channel_routing_project
  ON channel_routing_rules (project_id, channel_config_id, priority DESC);

CREATE TABLE IF NOT EXISTS channel_thread_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  external_user_id TEXT,
  external_user_name TEXT,
  linked_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_thread_link_unique
  ON channel_thread_links (project_id, room_id, channel_type, external_thread_id);
