-- P17-C: Conversation Intelligence + Gap Analytics
-- Tracks unanswered questions, intent clustering, and resolution analytics.

-- User questions extracted from conversations (to detect gaps)
CREATE TABLE IF NOT EXISTS conversation_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_status TEXT NOT NULL DEFAULT 'unanswered'
    CHECK(answer_status IN ('unanswered', 'answered_by_agent', 'answered_by_ai', 'no_answer')),
  answer_message_id INTEGER,
  answer_agent_id TEXT,
  confidence REAL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  answered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conv_questions_project_room ON conversation_questions(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_conv_questions_status ON conversation_questions(project_id, answer_status);
CREATE INDEX IF NOT EXISTS idx_conv_questions_user ON conversation_questions(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conv_questions_message ON conversation_questions(message_id);
CREATE INDEX IF NOT EXISTS idx_conv_questions_created ON conversation_questions(project_id, created_at DESC);

-- Recurring intent patterns clustered from messages
CREATE TABLE IF NOT EXISTS intent_clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  intent_label TEXT NOT NULL,
  intent_description TEXT,
  frequency INTEGER NOT NULL DEFAULT 1,
  sample_message_ids TEXT,  -- JSON array of message IDs
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intent_clusters_project ON intent_clusters(project_id, frequency DESC);
CREATE INDEX IF NOT EXISTS idx_intent_clusters_room ON intent_clusters(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_intent_clusters_label ON intent_clusters(project_id, intent_label);

-- Analytics snapshots for dashboards (pre-aggregated)
CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK(snapshot_type IN (
    'unanswered_questions', 'intent_frequency', 'escalation_reasons',
    'resolution_times', 'moderation_trends', 'weekly_digest'
  )),
  data TEXT NOT NULL,  -- JSON: aggregated analytics data
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  room_id TEXT,       -- NULL = project-wide snapshot
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intel_snapshots_project ON intelligence_snapshots(project_id, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_intel_snapshots_period ON intelligence_snapshots(project_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_intel_snapshots_room ON intelligence_snapshots(project_id, room_id);
