-- P15-G: AI Inbox Zero
-- Room summaries, priority ranking, suggested responses

CREATE TABLE IF NOT EXISTS inbox_summaries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points TEXT,
  action_items TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  time_range_start TEXT,
  time_range_end TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbox_summaries_room ON inbox_summaries(project_id, room_id, user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS inbox_priorities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  priority_score REAL NOT NULL DEFAULT 0,
  priority_reason TEXT,
  has_mention INTEGER NOT NULL DEFAULT 0,
  has_question INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT,
  sentiment TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_priorities_user ON inbox_priorities(project_id, user_id, priority_score DESC);

CREATE TABLE IF NOT EXISTS suggested_responses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  context_summary TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggested_responses_room ON suggested_responses(project_id, room_id, user_id, generated_at DESC);
