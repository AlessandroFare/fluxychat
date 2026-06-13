-- P19-A: Live Dashboards
CREATE TABLE IF NOT EXISTS live_dashboards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  layout TEXT NOT NULL DEFAULT 'grid',
  refresh_interval_ms INTEGER NOT NULL DEFAULT 5000,
  is_public INTEGER NOT NULL DEFAULT 0,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_dashboards_project ON live_dashboards(project_id);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dashboard_id) REFERENCES live_dashboards(id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dash ON dashboard_widgets(dashboard_id);

CREATE TABLE IF NOT EXISTS dashboard_data_points (
  id TEXT PRIMARY KEY,
  widget_id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  series_name TEXT NOT NULL DEFAULT 'default',
  value REAL NOT NULL,
  label TEXT,
  timestamp TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_data_widget ON dashboard_data_points(widget_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_data_time ON dashboard_data_points(timestamp);
