-- Tighten idempotency scope for client_message_id.
-- Prevent collisions across rooms and allow re-send after soft delete.

DROP INDEX IF EXISTS idx_messages_project_client_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_project_room_client_message_id
  ON messages (project_id, room_id, client_message_id)
  WHERE client_message_id IS NOT NULL AND deleted_at IS NULL;

