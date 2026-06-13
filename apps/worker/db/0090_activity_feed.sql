-- P19-D: Activity Feed Layer
CREATE TABLE IF NOT EXISTS activity_feeds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  feed_type TEXT NOT NULL DEFAULT 'project',
  room_id TEXT,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_feeds_project ON activity_feeds(project_id);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  action TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (feed_id) REFERENCES activity_feeds(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_events_feed ON activity_events(feed_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_time ON activity_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);
