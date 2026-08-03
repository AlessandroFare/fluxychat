-- #60 Slash commands: optional JSON config for tenant custom handlers
ALTER TABLE room_commands ADD COLUMN config_json TEXT;
ALTER TABLE room_commands ADD COLUMN updated_at TEXT;
