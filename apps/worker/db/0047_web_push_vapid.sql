-- P10-ext: Web Push subscriptions + VAPID (Sendbird/Web-Push parity, Pusher Beams gap)
-- https://www.w3.org/TR/push-api/
-- https://datatracker.ietf.org/doc/html/rfc8292 (VAPID)

-- Per-project VAPID keys (auto-generated on first request if absent).
-- subject is the "mailto:..." or "https://..." contact for the push service.
CREATE TABLE IF NOT EXISTS project_vapid_keys (
  project_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:admin@fluxychat.local',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Web Push subscriptions (PushSubscription.endpoint / keys.p256dh / keys.auth)
-- Endpoint is unique per project (RFC 8030 §6.2).
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sent_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_push_subscriptions_endpoint
  ON web_push_subscriptions (project_id, endpoint);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user
  ON web_push_subscriptions (project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_failures
  ON web_push_subscriptions (project_id, failure_count);
