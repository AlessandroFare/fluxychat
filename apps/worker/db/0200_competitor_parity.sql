-- CP-005: Per-project push credentials (dev/staging/prod)
CREATE TABLE IF NOT EXISTS project_push_config (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  fcm_server_key TEXT,
  fcm_project_id TEXT,
  apns_key_id TEXT,
  apns_team_id TEXT,
  apns_bundle_id TEXT,
  apns_private_key_pem TEXT,
  apns_use_sandbox INTEGER NOT NULL DEFAULT 0,
  web_push_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_project_push_config_project ON project_push_config(project_id);

-- CP-017: Room behavior flags applied by templates
CREATE TABLE IF NOT EXISTS room_behavior_settings (
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  typing_indicators_enabled INTEGER NOT NULL DEFAULT 1,
  read_receipts_enabled INTEGER NOT NULL DEFAULT 1,
  welcome_message TEXT,
  input_placeholder TEXT,
  template_slug TEXT,
  preset_features_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room_id, project_id)
);

-- CP-041: Canned responses for support agents
CREATE TABLE IF NOT EXISTS support_canned_responses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  shortcut TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  created_by TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_project ON support_canned_responses(project_id);

-- CP-043: Business hours per project
CREATE TABLE IF NOT EXISTS support_business_hours (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  schedule_json TEXT NOT NULL,
  offline_message TEXT NOT NULL DEFAULT 'We are currently offline. Leave a message and we will reply soon.',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- CP-020: Cross-room activity feed entries
CREATE TABLE IF NOT EXISTS user_activity_feed (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mention', 'reply', 'reaction', 'room_invite', 'agent_run', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  room_id TEXT,
  message_id INTEGER,
  actor_user_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON user_activity_feed(project_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON user_activity_feed(project_id, user_id, read_at);

-- CP-018: User contact / friend list
CREATE TABLE IF NOT EXISTS user_contacts (
  project_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  contact_user_id TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, owner_user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contacts_owner ON user_contacts(project_id, owner_user_id);

-- CP-003: Client-reported push delivery acks
CREATE TABLE IF NOT EXISTS push_delivery_acks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  delivery_log_id TEXT,
  room_id TEXT,
  message_id INTEGER,
  platform TEXT NOT NULL,
  received_at TEXT NOT NULL,
  client_meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_acks_project ON push_delivery_acks(project_id, received_at DESC);
