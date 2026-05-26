ALTER TABLE room_members ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE room_members ADD COLUMN preferences_json TEXT;
