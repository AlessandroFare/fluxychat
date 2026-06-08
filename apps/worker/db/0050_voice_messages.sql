-- Voice messages (P12-B) — extend `messages` with kind, audio metadata,
-- transcription fields, and a couple of indexes for filtering / lookups.
--
-- Design notes:
-- - `kind` defaults to 'text' so existing rows are unaffected.
-- - `audio_url` is the public URL (or R2 key) returned by the upload step
--   in `POST /messages/voice`.
-- - `transcription_status` is one of: NULL (not a voice message), 'pending',
--   'done', 'failed'. The async transcription job updates it from 'pending'
--   to 'done' / 'failed' in `ctx.waitUntil` after the HTTP response.
-- - `duration_ms` is the client-measured recording length (best effort).
--   Used by the inline player UI to render a duration label.
-- - Indexes target the two common reads:
--   * "show me all voice messages in this room" (kind filter, room/created order)
--   * "any messages still transcribing?" (transcription_status lookups)

ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN duration_ms INTEGER;
ALTER TABLE messages ADD COLUMN audio_url TEXT;
ALTER TABLE messages ADD COLUMN transcription TEXT;
ALTER TABLE messages ADD COLUMN transcription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_room_kind_created
  ON messages (project_id, room_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_transcription_status
  ON messages (transcription_status)
  WHERE transcription_status IS NOT NULL;
