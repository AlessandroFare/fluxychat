-- P20-A: Incident Response Rooms
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'sev3',
  status TEXT NOT NULL DEFAULT 'open',
  commander_id TEXT,
  oncall_user_id TEXT,
  alert_source TEXT,
  alert_id TEXT,
  environment TEXT,
  service TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT,
  resolved_at TEXT,
  closed_at TEXT,
  postmortem TEXT,
  root_cause TEXT,
  action_items TEXT NOT NULL DEFAULT '[]',
  timeline TEXT NOT NULL DEFAULT '[]',
  mttr_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

CREATE TABLE IF NOT EXISTS incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'comment',
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id);

CREATE TABLE IF NOT EXISTS incident_alerts (
  id TEXT PRIMARY KEY,
  incident_id TEXT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  source TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  acknowledged_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE INDEX IF NOT EXISTS idx_incident_alerts_project ON incident_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_status ON incident_alerts(status);
