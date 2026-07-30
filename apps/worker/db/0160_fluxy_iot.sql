-- FluxyIoT: devices, readings, rules, shadows (ROADMAP 5.2 persistence).

CREATE TABLE IF NOT EXISTS iot_devices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  fleet_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sensor',
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline', 'degraded', 'maintenance')),
  firmware_version TEXT NOT NULL DEFAULT '1.0.0',
  api_key_hash TEXT,
  metadata_json TEXT,
  location_json TEXT,
  last_seen TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_project
  ON iot_devices (project_id, fleet_id, status);

CREATE TABLE IF NOT EXISTS iot_readings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sensor TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_device_time
  ON iot_readings (project_id, device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS iot_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  device_id TEXT,
  fleet_id TEXT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  condition_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iot_rules_project
  ON iot_rules (project_id, enabled);

CREATE TABLE IF NOT EXISTS iot_device_shadows (
  device_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  reported_json TEXT NOT NULL DEFAULT '{}',
  desired_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);
