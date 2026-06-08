-- P10-SB2: Poll messages (Sendbird-style)
-- P10-SB5: Global user block list

CREATE TABLE IF NOT EXISTS message_polls (
  message_id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  allow_multiple INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_polls_room
  ON message_polls (project_id, room_id);

CREATE TABLE IF NOT EXISTS message_poll_votes (
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_message_poll_votes_user
  ON message_poll_votes (message_id, user_id);

CREATE TABLE IF NOT EXISTS user_blocks (
  project_id TEXT NOT NULL,
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, blocker_user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON user_blocks (project_id, blocked_user_id);
