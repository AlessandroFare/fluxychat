-- FluxyGame: cloud checkpoints (versioned) + quest moderation

CREATE TABLE IF NOT EXISTS game_checkpoints (
  project_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  checkpoint_key TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, player_id, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS idx_game_checkpoints_player
  ON game_checkpoints (project_id, player_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_quests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  objectives_json TEXT NOT NULL DEFAULT '[]',
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_quests_project
  ON game_quests (project_id, moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS game_quest_progress (
  project_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  progress_json TEXT NOT NULL DEFAULT '{}',
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, quest_id, player_id),
  FOREIGN KEY (quest_id) REFERENCES game_quests(id)
);

CREATE INDEX IF NOT EXISTS idx_game_quest_progress_player
  ON game_quest_progress (project_id, player_id, updated_at DESC);
