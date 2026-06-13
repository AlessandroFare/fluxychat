-- Business Object Sync: non-message entities in rooms

CREATE TABLE IF NOT EXISTS business_objects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bizobj_room_type
  ON business_objects (room_id, object_type, state);

CREATE INDEX IF NOT EXISTS idx_bizobj_room_id
  ON business_objects (room_id, object_id);

CREATE TABLE IF NOT EXISTS business_object_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  actor_user_id TEXT,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bizobj_events_room
  ON business_object_events (room_id, object_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_object_subscriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  object_type TEXT,
  event_types_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bizobj_subs_room
  ON business_object_subscriptions (room_id, enabled);
