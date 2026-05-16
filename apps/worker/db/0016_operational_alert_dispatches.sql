-- External dispatch tracking for operational alerts (with dedupe)

CREATE TABLE IF NOT EXISTS operational_alert_dispatches (
  id TEXT PRIMARY KEY, -- deterministic dedupe id: channel + event + target
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel TEXT NOT NULL, -- webhook | slack | email (future)
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | dispatched | failed
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_http_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dispatched_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_alert_dispatches_event
  ON operational_alert_dispatches (event_id, channel, target);

CREATE INDEX IF NOT EXISTS idx_operational_alert_dispatches_project_created
  ON operational_alert_dispatches (project_id, created_at DESC);

