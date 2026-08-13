-- PH-113: per-room asymmetric session profiles (role packs)
CREATE TABLE IF NOT EXISTS room_session_profiles (
  room_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  asymmetry_profile_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_session_profiles_project
  ON room_session_profiles (project_id);
