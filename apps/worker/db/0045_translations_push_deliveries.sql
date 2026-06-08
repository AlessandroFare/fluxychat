-- P10-SB3: Message translations
-- P10-SB4: Per-recipient delivery receipts
-- P10-SB7: Push device tokens

CREATE TABLE IF NOT EXISTS message_translations (
  message_id INTEGER NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang TEXT,
  provider TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, target_lang)
);

CREATE TABLE IF NOT EXISTS message_deliveries (
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_message
  ON message_deliveries (message_id);

CREATE TABLE IF NOT EXISTS user_push_devices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_devices_token
  ON user_push_devices (project_id, platform, token);

CREATE INDEX IF NOT EXISTS idx_user_push_devices_user
  ON user_push_devices (project_id, user_id);
