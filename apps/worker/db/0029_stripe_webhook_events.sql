-- Stripe webhook idempotency guard.
-- Stripe may retry or deliver duplicate events; we persist processed ids.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

