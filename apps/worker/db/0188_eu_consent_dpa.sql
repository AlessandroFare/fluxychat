-- EU consent / DPA audit log (roadmap #42) — pairs with project_data_residency (#14)

CREATE TABLE IF NOT EXISTS project_consent_settings (
  project_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  auto_eu_only INTEGER NOT NULL DEFAULT 1,
  dpa_version TEXT NOT NULL DEFAULT '1.0',
  banner_title TEXT,
  banner_body TEXT,
  dpa_document_url TEXT,
  require_room_consent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT,
  event_type TEXT NOT NULL,
  dpa_version TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consent_events_project_user
  ON consent_events (project_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_events_project_room
  ON consent_events (project_id, room_id, created_at DESC);
