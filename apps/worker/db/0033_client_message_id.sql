-- Client-generated id for optimistic send dedupe (SDK POST /messages).
ALTER TABLE messages ADD COLUMN client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_project_client_message_id
  ON messages (project_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
