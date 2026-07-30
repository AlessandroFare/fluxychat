-- FluxyCollab: Room as a Project metadata
-- Migration 0153

ALTER TABLE rooms ADD COLUMN project_goal TEXT;
ALTER TABLE rooms ADD COLUMN project_budget REAL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN project_timeline_start TEXT;
ALTER TABLE rooms ADD COLUMN project_timeline_end TEXT;
ALTER TABLE rooms ADD COLUMN project_status TEXT DEFAULT 'planning';
ALTER TABLE rooms ADD COLUMN spatial_x REAL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN spatial_y REAL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN spatial_z REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS collab_spatial_objects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT 'avatar',
  label TEXT,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  pos_z REAL NOT NULL DEFAULT 0,
  rot_x REAL DEFAULT 0,
  rot_y REAL DEFAULT 0,
  rot_z REAL DEFAULT 0,
  scale REAL DEFAULT 1,
  data_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spatial_objects_room ON collab_spatial_objects(project_id, room_id);
