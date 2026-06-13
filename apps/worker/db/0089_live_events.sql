-- P19-B: Live Event Interactions
CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'webinar',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  max_participants INTEGER DEFAULT 1000,
  started_at TEXT,
  ended_at TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_events_project ON live_events(project_id);
CREATE INDEX IF NOT EXISTS idx_live_events_room ON live_events(room_id);

CREATE TABLE IF NOT EXISTS event_qa (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  upvotes INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT,
  answer TEXT,
  answered_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_qa_event ON event_qa(event_id);
CREATE INDEX IF NOT EXISTS idx_event_qa_status ON event_qa(status);

CREATE TABLE IF NOT EXISTS event_speakers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'speaker',
  status TEXT NOT NULL DEFAULT 'invited',
  joined_at TEXT,
  left_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_speakers_event ON event_speakers(event_id);

CREATE TABLE IF NOT EXISTS event_reactions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_reactions_event ON event_reactions(event_id);
