-- P19-F: AI Live Q&A Moderator
CREATE TABLE IF NOT EXISTS qa_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  dedup_threshold REAL DEFAULT 0.8,
  max_questions_per_user INTEGER DEFAULT 5,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_qa_sessions_event ON qa_sessions(event_id);

CREATE TABLE IF NOT EXISTS qa_moderated_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  original_question TEXT NOT NULL,
  normalized_question TEXT,
  duplicate_of_id TEXT,
  ai_category TEXT,
  ai_priority_score REAL DEFAULT 0,
  ai_suggested_answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES qa_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_qa_mod_questions_session ON qa_moderated_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_mod_questions_status ON qa_moderated_questions(status);
CREATE INDEX IF NOT EXISTS idx_qa_mod_questions_priority ON qa_moderated_questions(ai_priority_score DESC);
