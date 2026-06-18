-- Audit B-7: idempotency key for automation enqueue.
--
-- The `idempotency_key` is a deterministic hash of
--   (project_id, event_type, message_id, kind)
-- so a retried delivery (e.g. ctx.waitUntil re-fired after a Worker
-- eviction, or a cron batch replay) does not enqueue the same
-- automation twice. The UNIQUE constraint enforces dedup at the DB
-- layer; the application uses INSERT OR IGNORE.

ALTER TABLE automation_events ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_events_idempotency
  ON automation_events (project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
