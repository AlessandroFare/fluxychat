-- FluxyGame tournament brackets (D1 persistence)

CREATE TABLE IF NOT EXISTS game_tournaments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  name TEXT NOT NULL,
  prize TEXT,
  max_players INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'registration'
    CHECK (status IN ('registration', 'in_progress', 'completed', 'cancelled')),
  bracket_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_tournaments_project
  ON game_tournaments (project_id, status, updated_at DESC);
