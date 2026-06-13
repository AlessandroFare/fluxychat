-- P18-H: SLA 99.9% Monitoring
CREATE TABLE IF NOT EXISTS slo_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target REAL NOT NULL DEFAULT 99.9,
  window_days INTEGER NOT NULL DEFAULT 30,
  metric_type TEXT NOT NULL DEFAULT 'availability',
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slo_definitions_project ON slo_definitions(project_id);

CREATE TABLE IF NOT EXISTS sli_data_points (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  slo_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  value REAL NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (slo_id) REFERENCES slo_definitions(id)
);

CREATE INDEX IF NOT EXISTS idx_sli_data_project_slo ON sli_data_points(project_id, slo_id);
CREATE INDEX IF NOT EXISTS idx_sli_data_timestamp ON sli_data_points(timestamp);

-- P18-I: Predictive Engagement AI
CREATE TABLE IF NOT EXISTS user_activity_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT,
  activity_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_activity_project_user ON user_activity_log(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity_log(timestamp);
