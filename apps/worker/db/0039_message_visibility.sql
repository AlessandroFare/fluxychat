-- Whisper / limited visibility (default room-visible).
ALTER TABLE messages ADD COLUMN visibility TEXT;
ALTER TABLE messages ADD COLUMN visible_to_json TEXT;
