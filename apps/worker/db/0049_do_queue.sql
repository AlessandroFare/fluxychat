-- Bounded DO queue with per-entry TTL.
-- Used as a generic FIFO for short-lived cross-DO / cross-shard messages
-- (e.g. per-user "deliver on reconnect" outbox when KV writes fail, or a
-- chat-state command queue). The cap is enforced in app code (see
-- `lib/do-queue.js`), not by the table itself.

CREATE TABLE IF NOT EXISTS do_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_do_queue_queue
  ON do_queue(queue, id);

CREATE INDEX IF NOT EXISTS idx_do_queue_expires
  ON do_queue(queue, expires_at);
