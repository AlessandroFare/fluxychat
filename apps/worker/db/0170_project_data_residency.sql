-- Project data residency / region pinning (roadmap #14)

CREATE TABLE IF NOT EXISTS project_data_residency (
  project_id TEXT PRIMARY KEY,
  primary_region TEXT NOT NULL DEFAULT 'eu-west',
  allowed_regions_json TEXT NOT NULL DEFAULT '["eu-west"]',
  inference_region TEXT,
  enforce_writes INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_data_residency_region
  ON project_data_residency (primary_region);
