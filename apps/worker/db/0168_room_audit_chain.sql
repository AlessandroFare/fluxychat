-- Immutable append-only audit hash chain (roadmap #20)

CREATE TABLE IF NOT EXISTS room_audit_chain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_audit_chain_project_id
  ON room_audit_chain (project_id, id ASC);
