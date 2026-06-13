-- P20-D: Community Moderation + Reputation
CREATE TABLE IF NOT EXISTS community_reputation (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  trusted INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  mutes INTEGER NOT NULL DEFAULT 0,
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_user ON community_reputation(project_id, user_id);

CREATE TABLE IF NOT EXISTS reputation_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user ON reputation_events(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_type ON reputation_events(event_type);

CREATE TABLE IF NOT EXISTS anti_spam_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  action TEXT NOT NULL DEFAULT 'warn',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spam_rules_project ON anti_spam_rules(project_id);
