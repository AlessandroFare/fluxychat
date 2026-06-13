-- P17-B: Escalation Design with SLA + Reminders
-- Multi-tier escalation rules with automated SLA breach scanning and notifications.

-- Escalation rules per project (multi-tier)
CREATE TABLE IF NOT EXISTS escalation_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  trigger_after_minutes INTEGER NOT NULL DEFAULT 15,
  action TEXT NOT NULL DEFAULT 'notify_supervisor'
    CHECK(action IN ('notify_supervisor', 'reassign', 'alert_manager', 'notify_room', 'create_task')),
  target_user_id TEXT,
  target_role TEXT,
  notification_message TEXT,
  room_announce INTEGER NOT NULL DEFAULT 0,
  repeat_interval_minutes INTEGER,
  max_repeats INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_project ON escalation_rules(project_id, enabled, trigger_after_minutes ASC);

-- Escalation events audit trail
CREATE TABLE IF NOT EXISTS escalation_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  tier_index INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  target_user_id TEXT,
  triggered_at TEXT NOT NULL,
  resolved_at TEXT,
  repeat_count INTEGER NOT NULL DEFAULT 0,
  notification_sent INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_task ON escalation_events(project_id, task_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_project ON escalation_events(project_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_events_pending ON escalation_events(project_id, resolved_at) WHERE resolved_at IS NULL;
