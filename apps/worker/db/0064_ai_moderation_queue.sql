-- P16-E: AI Semantic Moderation Queue
-- LLM-based toxicity, spam, PII, and harassment detection.
-- Replaces/extends simple substring blocklist with intelligent content analysis.
CREATE TABLE IF NOT EXISTS ai_moderation_queue (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  user_id TEXT NOT NULL,
  content TEXT,                          -- original message content
  severity TEXT NOT NULL CHECK(severity IN ('none', 'low', 'medium', 'high', 'critical')),
  categories TEXT,                       -- JSON array: ["toxicity", "spam", "pii", "harassment", "self_harm"]
  reason TEXT,                           -- human-readable explanation
  confidence REAL DEFAULT 0.8,
  suggested_action TEXT NOT NULL CHECK(suggested_action IN ('none', 'log', 'flag', 'warn', 'delete', 'mute', 'ban')),
  auto_action_taken TEXT,               -- action automatically applied (NULL if pending review)
  reviewed_by TEXT,                     -- moderator userId who reviewed
  reviewed_at TEXT,
  review_action TEXT,                   -- moderator's final action: confirm/override/dismiss
  review_notes TEXT,
  source_message_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_project_room ON ai_moderation_queue(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_severity ON ai_moderation_queue(project_id, severity);
CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_pending ON ai_moderation_queue(project_id, reviewed_by) WHERE reviewed_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_user ON ai_moderation_queue(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_message ON ai_moderation_queue(message_id);
