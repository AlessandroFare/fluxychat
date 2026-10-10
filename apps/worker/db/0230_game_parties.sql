-- Nakama-shaped parties (pre-match roster on the room, not a second game server).

CREATE TABLE IF NOT EXISTS game_parties (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  leader_id TEXT NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 4,
  members_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_parties_project
  ON game_parties (project_id, updated_at DESC);
