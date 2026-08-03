-- Live stream VOD replays (Cloudflare Stream recordings + manual HTTPS fallback)

CREATE TABLE IF NOT EXISTS live_stream_replays (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cloudflare'
    CHECK (source IN ('cloudflare', 'manual')),
  video_uid TEXT,
  label TEXT,
  playback_hls TEXT,
  playback_dash TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ready_at TEXT,
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_replays_event
  ON live_stream_replays (project_id, event_id, is_primary DESC, created_at DESC);
