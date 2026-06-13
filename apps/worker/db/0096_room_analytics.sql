-- P20-C: Live Analytics Room
CREATE TABLE IF NOT EXISTS room_kpis (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kpi_type TEXT NOT NULL DEFAULT 'counter',
  source TEXT NOT NULL DEFAULT 'manual',
  config TEXT NOT NULL DEFAULT '{}',
  value REAL DEFAULT 0,
  unit TEXT,
  target REAL,
  trend TEXT DEFAULT 'flat',
  last_updated_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_room_kpis_room ON room_kpis(project_id, room_id);

CREATE TABLE IF NOT EXISTS room_kpi_values (
  id TEXT PRIMARY KEY,
  kpi_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  value REAL NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (kpi_id) REFERENCES room_kpis(id)
);

CREATE INDEX IF NOT EXISTS idx_room_kpi_values_kpi ON room_kpi_values(kpi_id);
CREATE INDEX IF NOT EXISTS idx_room_kpi_values_time ON room_kpi_values(recorded_at);
