-- Wave E (chat core): custom emoji, saved messages, user groups, room folders,
-- notification keywords, channel bookmarks, also-send-to-channel, attachment AI summary.

CREATE TABLE IF NOT EXISTS custom_emojis (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS saved_messages (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id, message_id)
);

CREATE TABLE IF NOT EXISTS user_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS user_group_members (
  group_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_folder_items (
  folder_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (folder_id, room_id)
);

CREATE TABLE IF NOT EXISTS user_notification_keywords (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, user_id, word)
);

CREATE TABLE IF NOT EXISTS room_bookmarks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE messages ADD COLUMN also_to_channel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attachments ADD COLUMN ai_summary TEXT;
