-- Room MLS group registry (coordination layer for #30 — client holds crypto keys)

CREATE TABLE IF NOT EXISTS room_mls_groups (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  epoch INTEGER NOT NULL DEFAULT 0,
  cipher_suite TEXT NOT NULL DEFAULT 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  max_devices INTEGER NOT NULL DEFAULT 64,
  devices_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_mls_groups_project
  ON room_mls_groups (project_id, updated_at DESC);
