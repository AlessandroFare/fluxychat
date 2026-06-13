-- P20-F: On-Call Collaboration Layer
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rotation_hours INTEGER NOT NULL DEFAULT 12,
  escalation_minutes INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_project ON oncall_schedules(project_id);

CREATE TABLE IF NOT EXISTS oncall_shifts (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (schedule_id) REFERENCES oncall_schedules(id)
);

CREATE INDEX IF NOT EXISTS idx_oncall_shifts_schedule ON oncall_shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_shifts_user ON oncall_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_oncall_shifts_time ON oncall_shifts(start_at, end_at);
