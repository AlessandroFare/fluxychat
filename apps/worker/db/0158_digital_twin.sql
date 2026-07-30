-- Digital Twin: spatial scenes, entities, agent grants (H-5 persistence).

CREATE TABLE IF NOT EXISTS spatial_scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  name TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spatial_scenes_project
  ON spatial_scenes (project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_spatial_scenes_room
  ON spatial_scenes (project_id, room_id);

CREATE TABLE IF NOT EXISTS spatial_entities (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  position_json TEXT NOT NULL,
  rotation_json TEXT,
  properties_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (scene_id) REFERENCES spatial_scenes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spatial_entities_scene
  ON spatial_entities (project_id, scene_id);

CREATE TABLE IF NOT EXISTS spatial_agent_grants (
  scene_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  grants_json TEXT NOT NULL DEFAULT '["view"]',
  entity_filter_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (scene_id, agent_id),
  FOREIGN KEY (scene_id) REFERENCES spatial_scenes(id) ON DELETE CASCADE
);
