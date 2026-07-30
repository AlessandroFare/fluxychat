-- FluxyStream: reconcile live event schemas and add broadcast primitives.
-- Idempotent: uses ALTER TABLE ADD COLUMN (fails silently if column exists in D1 batch mode).
-- 0155_fluxy_stream_reconcile.sql is the canonical reconciliation migration.

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_events_input_uid
  ON live_events (live_input_uid) WHERE live_input_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_events_project_status
  ON live_events (project_id, status, created_at DESC);

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
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'rendering', 'ready', 'failed')),
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
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
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
