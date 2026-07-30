-- FluxyGame: lobbies, matches, player profiles (ROADMAP 5.1 persistence).

CREATE TABLE IF NOT EXISTS game_lobbies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  game_mode TEXT NOT NULL DEFAULT 'deathmatch',
  max_players INTEGER NOT NULL DEFAULT 4,
  host_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting'
    CHECK (state IN ('waiting', 'ready', 'starting', 'in_game', 'post_game')),
  players_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_lobbies_project
  ON game_lobbies (project_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_matches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lobby_id TEXT,
  status TEXT NOT NULL DEFAULT 'playing'
    CHECK (status IN ('lobby', 'countdown', 'playing', 'ended', 'cancelled')),
  state_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  FOREIGN KEY (lobby_id) REFERENCES game_lobbies(id)
);

CREATE INDEX IF NOT EXISTS idx_game_matches_project
  ON game_matches (project_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS game_player_profiles (
  project_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  username TEXT NOT NULL,
  skill_rating INTEGER NOT NULL DEFAULT 1000,
  region TEXT NOT NULL DEFAULT 'eu',
  stats_json TEXT,
  cloud_save_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_player_profiles_rating
  ON game_player_profiles (project_id, skill_rating DESC);
