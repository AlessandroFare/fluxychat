-- Optional TTL for ephemeral messages (soft-deleted when expires_at passes).
ALTER TABLE messages ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_room_expires_at
  ON messages (project_id, room_id, expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
