-- P17-E: AI Moderation Queue + Review Enhancements
-- Priority scoring, bulk actions, SLA tracking, and false-positive feedback loop.

-- Feedback on moderation decisions (false positive / true positive tracking)
CREATE TABLE IF NOT EXISTS moderation_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  queue_event_id TEXT NOT NULL,            -- FK to ai_moderation_queue.id
  moderator_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK(feedback_type IN ('true_positive', 'false_positive', 'uncertain')),
  reason TEXT,
  category_accuracy TEXT,                  -- JSON: { "toxicity": true, "spam": false }
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_feedback_project ON moderation_feedback(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_feedback_event ON moderation_feedback(queue_event_id);
CREATE INDEX IF NOT EXISTS idx_mod_feedback_type ON moderation_feedback(project_id, feedback_type);

-- SLA configuration per project
CREATE TABLE IF NOT EXISTS moderation_sla_config (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('none', 'low', 'medium', 'high', 'critical')),
  sla_minutes INTEGER NOT NULL DEFAULT 60,
  escalation_enabled INTEGER NOT NULL DEFAULT 1,
  escalation_severity TEXT CHECK(escalation_severity IN ('low', 'medium', 'high', 'critical')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, severity)
);

CREATE INDEX IF NOT EXISTS idx_mod_sla_project ON moderation_sla_config(project_id, enabled);

-- SLA breach events (audit trail)
CREATE TABLE IF NOT EXISTS moderation_sla_breaches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  queue_event_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  sla_minutes INTEGER NOT NULL,
  breached_at TEXT NOT NULL,
  escalated_to TEXT,                       -- moderatorId or 'system'
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_sla_breaches_project ON moderation_sla_breaches(project_id, breached_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_sla_breaches_unresolved ON moderation_sla_breaches(project_id, resolved_at) WHERE resolved_at IS NULL;
