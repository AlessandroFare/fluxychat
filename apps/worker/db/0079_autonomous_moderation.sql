-- P15-J: Autonomous Moderation
-- Auto-action engine, confidence thresholds, action history

CREATE TABLE IF NOT EXISTS moderation_auto_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  severity_min TEXT NOT NULL DEFAULT 'high' CHECK(severity_min IN ('low', 'medium', 'high', 'critical')),
  confidence_min REAL NOT NULL DEFAULT 0.8,
  action TEXT NOT NULL DEFAULT 'warn' CHECK(action IN ('log', 'warn', 'mute', 'timeout', 'kick', 'ban', 'quarantine', 'flag_only')),
  mute_duration_minutes INTEGER DEFAULT 30,
  timeout_duration_minutes INTEGER DEFAULT 60,
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  max_actions_per_hour INTEGER NOT NULL DEFAULT 10,
  notify_admins INTEGER NOT NULL DEFAULT 1,
  notify_user INTEGER NOT NULL DEFAULT 1,
  appeal_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auto_rules_project ON moderation_auto_rules(project_id, is_active);

CREATE TABLE IF NOT EXISTS moderation_auto_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER,
  rule_id TEXT,
  action TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  reason TEXT,
  ai_raw_response TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  appealed INTEGER NOT NULL DEFAULT 0,
  appeal_result TEXT,
  appeal_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auto_actions_user ON moderation_auto_actions(project_id, user_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_actions_room ON moderation_auto_actions(project_id, room_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_actions_expires ON moderation_auto_actions(expires_at) WHERE expires_at IS NOT NULL;
