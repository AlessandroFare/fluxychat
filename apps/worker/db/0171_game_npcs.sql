-- FluxyGame AI NPC profiles with D1-backed memory (roadmap game vertical).

CREATE TABLE IF NOT EXISTS game_npcs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  personality TEXT NOT NULL DEFAULT 'friendly',
  difficulty REAL NOT NULL DEFAULT 0.5,
  memory_json TEXT,
  state TEXT NOT NULL DEFAULT 'idle',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_npcs_project
  ON game_npcs (project_id, updated_at DESC);
