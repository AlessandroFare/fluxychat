-- Live Streaming Chat

CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pre_live', 'live', 'post_live', 'ended')),
  stream_url TEXT,
  thumbnail_url TEXT,
  category TEXT,
  tags TEXT,
  started_at TEXT,
  ended_at TEXT,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  total_viewers INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_event_project
  ON live_events (project_id, status);
CREATE INDEX IF NOT EXISTS idx_live_event_room
  ON live_events (room_id, status);
CREATE INDEX IF NOT EXISTS idx_live_event_status
  ON live_events (status, started_at DESC);

CREATE TABLE IF NOT EXISTS live_chat_rules (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  slow_mode_seconds INTEGER NOT NULL DEFAULT 0,
  emote_only INTEGER NOT NULL DEFAULT 0,
  subscriber_only INTEGER NOT NULL DEFAULT 0,
  follower_only INTEGER NOT NULL DEFAULT 0,
  follower_minutes INTEGER NOT NULL DEFAULT 0,
  link_protection INTEGER NOT NULL DEFAULT 0,
  max_message_length INTEGER NOT NULL DEFAULT 500,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_rule_event
  ON live_chat_rules (event_id);

CREATE TABLE IF NOT EXISTS live_viewers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('host', 'moderator', 'vip', 'subscriber', 'viewer')),
  joined_at TEXT NOT NULL,
  left_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  is_muted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_live_viewer_event
  ON live_viewers (event_id, left_at);
CREATE INDEX IF NOT EXISTS idx_live_viewer_user
  ON live_viewers (user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_live_viewer_project
  ON live_viewers (project_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS live_pinned_messages (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  pinned_by TEXT,
  pinned_at TEXT NOT NULL,
  unpinned_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_live_pinned_event
  ON live_pinned_messages (event_id, unpinned_at, sort_order);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'emote', 'gip', 'super_chat', 'announcement')),
  is_highlighted INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_by TEXT,
  deleted_reason TEXT,
  badge TEXT,
  color TEXT,
  reply_to_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_msg_event
  ON live_chat_messages (event_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_live_msg_project
  ON live_chat_messages (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_chat_analytics (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  timestamp_bucket TEXT NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  viewers_count INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  new_viewers INTEGER NOT NULL DEFAULT 0,
  unique_chatters INTEGER NOT NULL DEFAULT 0,
  avg_message_length REAL NOT NULL DEFAULT 0,
  engagement_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_analytics_bucket
  ON live_chat_analytics (event_id, timestamp_bucket);
CREATE INDEX IF NOT EXISTS idx_live_analytics_project
  ON live_chat_analytics (project_id, created_at DESC);
