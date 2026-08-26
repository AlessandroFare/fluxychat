-- Room feeds (Liveblocks Feeds analogue). Distinct from chat messages.

CREATE TABLE IF NOT EXISTS room_feeds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'activity',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_feeds_room
  ON room_feeds (project_id, room_id, created_at);

CREATE TABLE IF NOT EXISTS room_feed_messages (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_feed_messages_feed
  ON room_feed_messages (feed_id, created_at);
