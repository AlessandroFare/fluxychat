-- P15-M: Polls & Forms inline
-- Polls (single/multi choice), forms (structured data collection), CSAT

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  poll_type TEXT NOT NULL DEFAULT 'single' CHECK(poll_type IN ('single', 'multi', 'rating', 'yes_no')),
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  is_closed INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_polls_room ON polls(project_id, room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_polls_message ON polls(message_id);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, sort_order);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
  UNIQUE(poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id, poll_id);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  is_closed INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_forms_room ON forms(project_id, room_id, created_at);

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  UNIQUE(form_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
