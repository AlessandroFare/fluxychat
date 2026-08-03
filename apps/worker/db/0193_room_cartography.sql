-- #53 Chat Cartography — batch clustering cache for room message maps
CREATE TABLE IF NOT EXISTS room_cartography_maps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  message_count INTEGER NOT NULL DEFAULT 0,
  cluster_count INTEGER NOT NULL DEFAULT 0,
  clusters_json TEXT NOT NULL,
  points_json TEXT NOT NULL,
  built_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_cartography_maps_room
  ON room_cartography_maps(project_id, room_id, built_at DESC);
