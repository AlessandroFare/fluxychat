-- P19-E: Realtime Notifications Engine
CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'in_app',
  config TEXT NOT NULL DEFAULT '{}',
  rate_limit_per_minute INTEGER DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_project ON notification_channels(project_id);

CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '{}',
  template TEXT NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  rule_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user ON notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_time ON notification_deliveries(created_at);
