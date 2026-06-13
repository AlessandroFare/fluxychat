-- P19-J: Command Palette for Room
CREATE TABLE IF NOT EXISTS room_commands (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  command TEXT NOT NULL,
  description TEXT NOT NULL,
  usage TEXT,
  handler TEXT NOT NULL,
  required_role TEXT DEFAULT 'member',
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_room_cmd_project ON room_commands(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_cmd_project_command ON room_commands(project_id, command);
