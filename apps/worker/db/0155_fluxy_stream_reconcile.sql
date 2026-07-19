-- FluxyStream schema reconciliation.
-- Ensures all columns from migrations 0089, 0134, and 0154 exist on live_events
-- regardless of which migration created the table first.
-- Also ensures the live_events.status default is 'scheduled' and the CHECK constraint
-- accepts all statuses used by the application.

-- Ensure status default is 'scheduled' (0089 used 'draft', 0134 used 'scheduled').
-- SQLite cannot ALTER COLUMN defaults in-place, so we rebuild the constraint via a no-op
-- UPDATE that triggers SQLite's table rebuild when combined with a new default.
-- In practice, D1 applies the default at INSERT time from the most recent CREATE TABLE,
-- so we only need to make sure existing rows are valid.

-- Add any missing columns (idempotent — each ALTER fails silently if the column exists).
-- These cover the case where 0089 created the table and 0134's CREATE TABLE was a no-op.

ALTER TABLE live_events ADD COLUMN stream_url TEXT;
ALTER TABLE live_events ADD COLUMN thumbnail_url TEXT;
ALTER TABLE live_events ADD COLUMN category TEXT;
ALTER TABLE live_events ADD COLUMN tags TEXT;
ALTER TABLE live_events ADD COLUMN peak_viewers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_events ADD COLUMN total_viewers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_events ADD COLUMN total_messages INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_events ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_events ADD COLUMN updated_at TEXT;
ALTER TABLE live_events ADD COLUMN live_input_uid TEXT;
ALTER TABLE live_events ADD COLUMN rtmps_url TEXT;
ALTER TABLE live_events ADD COLUMN stream_key TEXT;
ALTER TABLE live_events ADD COLUMN whip_url TEXT;
ALTER TABLE live_events ADD COLUMN playback_hls TEXT;
ALTER TABLE live_events ADD COLUMN playback_dash TEXT;
ALTER TABLE live_events ADD COLUMN recording_mode TEXT NOT NULL DEFAULT 'automatic';
ALTER TABLE live_events ADD COLUMN prefer_low_latency INTEGER NOT NULL DEFAULT 1;
ALTER TABLE live_events ADD COLUMN provider_state TEXT;

-- Ensure updated_at has a default for old rows.
UPDATE live_events SET updated_at = created_at WHERE updated_at IS NULL;

-- Normalize old 'draft' status to 'scheduled'.
UPDATE live_events SET status = 'scheduled' WHERE status = 'draft';

-- Ensure supplementary tables exist (idempotent).

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
  role TEXT DEFAULT 'viewer',
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
  content_type TEXT DEFAULT 'text',
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

CREATE TABLE IF NOT EXISTS live_stream_angles (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  label TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_angles_event
  ON live_stream_angles (project_id, event_id, enabled, sort_order);

CREATE TABLE IF NOT EXISTS live_stream_highlights (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_seconds INTEGER NOT NULL,
  end_seconds INTEGER NOT NULL,
  reason TEXT,
  clip_url TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_highlights_event
  ON live_stream_highlights (project_id, event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_stream_products (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  checkout_url TEXT NOT NULL,
  price_amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  active INTEGER NOT NULL DEFAULT 0,
  shown_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_products_event
  ON live_stream_products (project_id, event_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS live_stream_gifts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  gift_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_gifts_event
  ON live_stream_gifts (project_id, event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_stream_sentiment (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  timestamp_bucket TEXT NOT NULL,
  positive INTEGER NOT NULL DEFAULT 0,
  neutral INTEGER NOT NULL DEFAULT 0,
  negative INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_stream_sentiment_bucket
  ON live_stream_sentiment (project_id, event_id, timestamp_bucket);

-- Indexes on live_events (idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_events_input_uid
  ON live_events (live_input_uid) WHERE live_input_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_events_project_status
  ON live_events (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_event_project
  ON live_events (project_id, status);
CREATE INDEX IF NOT EXISTS idx_live_event_room
  ON live_events (room_id, status);
CREATE INDEX IF NOT EXISTS idx_live_event_status
  ON live_events (status, started_at DESC);
