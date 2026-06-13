-- Realtime room insights: live metrics visible to participants

CREATE TABLE IF NOT EXISTS room_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('engagement', 'activity', 'sentiment', 'queue', 'sla', 'performance', 'custom')),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metadata_json TEXT,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_insights_room_type
  ON room_insights (room_id, insight_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_insights_room_name
  ON room_insights (room_id, metric_name, recorded_at DESC);

CREATE TABLE IF NOT EXISTS room_insight_subscriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  insight_types_json TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insight_subs_room
  ON room_insight_subscriptions (room_id, enabled);
