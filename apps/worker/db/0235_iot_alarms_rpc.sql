-- ThingsBoard AlarmController + device RPC (HTTP), not MQTT.
CREATE TABLE IF NOT EXISTS iot_alarms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  rule_id TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acked', 'cleared')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  acked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_iot_alarms_project
  ON iot_alarms (project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS iot_rpc (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  method TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'expired')),
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  replied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_iot_rpc_device
  ON iot_rpc (project_id, device_id, status, created_at);
