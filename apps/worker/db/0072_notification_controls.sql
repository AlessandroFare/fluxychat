-- P17-H: Notification Controls Granular — per-topic, digest, snooze, priority

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  room_id TEXT,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  in_app_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  digest_frequency TEXT NOT NULL DEFAULT 'realtime' CHECK (digest_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'never')),
  priority_level TEXT NOT NULL DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_pref_unique
  ON user_notification_preferences (project_id, user_id, topic, room_id);

CREATE INDEX IF NOT EXISTS idx_notif_pref_project_user
  ON user_notification_preferences (project_id, user_id);

CREATE TABLE IF NOT EXISTS notification_snooze_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT,
  thread_id TEXT,
  customer_id TEXT,
  snooze_until TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_snooze_user
  ON notification_snooze_rules (project_id, user_id, snooze_until);

CREATE INDEX IF NOT EXISTS idx_notif_snooze_room
  ON notification_snooze_rules (project_id, room_id, snooze_until);
