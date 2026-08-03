-- #47 Room Firmware — per-room programmable veto/modify hooks (builtin MVP; WASM-ready)

CREATE TABLE IF NOT EXISTS room_firmware (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  module_type TEXT NOT NULL DEFAULT 'builtin',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  wasm_r2_key TEXT,
  wasm_module_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_firmware_project_room
  ON room_firmware (project_id, room_id);

CREATE TABLE IF NOT EXISTS room_firmware_audit (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  module_id TEXT,
  decision TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_firmware_audit_room
  ON room_firmware_audit (project_id, room_id, created_at DESC);
