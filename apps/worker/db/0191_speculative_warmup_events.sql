-- #49 Typing-triggered speculative agent warmup telemetry
CREATE TABLE IF NOT EXISTS speculative_warmup_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT,
  outcome TEXT NOT NULL,
  context_count INTEGER NOT NULL DEFAULT 0,
  partial_len INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_speculative_warmup_events_project
  ON speculative_warmup_events(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_speculative_warmup_events_room
  ON speculative_warmup_events(room_id, created_at DESC);
