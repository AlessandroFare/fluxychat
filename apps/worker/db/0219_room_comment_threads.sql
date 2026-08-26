-- Contextual comment threads (Liveblocks Comments analogue). Distinct from chat parent_id replies.

CREATE TABLE IF NOT EXISTS room_comment_threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_comment_threads_room
  ON room_comment_threads (project_id, room_id, created_at);

CREATE TABLE IF NOT EXISTS room_comment_thread_comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_comment_comments_thread
  ON room_comment_thread_comments (thread_id, created_at);
