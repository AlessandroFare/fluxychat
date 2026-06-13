-- P17-L: Mobile-First UX + Offline Queue
-- Push delivery tracking, offline message queue, device management

CREATE TABLE IF NOT EXISTS push_delivery_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  platform TEXT NOT NULL CHECK(platform IN ('fcm', 'apns', 'web', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'expired')),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_user ON push_delivery_log(project_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_push_delivery_status ON push_delivery_log(status, created_at) WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS offline_message_queue (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  client_id TEXT,
  content TEXT NOT NULL,
  temp_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_message_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_room ON offline_message_queue(room_id, status);

CREATE TABLE IF NOT EXISTS device_registrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('fcm', 'apns', 'web', 'android', 'ios')),
  endpoint TEXT,
  push_token TEXT,
  app_version TEXT,
  os_version TEXT,
  device_model TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_reg_user ON device_registrations(project_id, user_id, is_active);
