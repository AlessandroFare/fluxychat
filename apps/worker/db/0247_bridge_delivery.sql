-- Bridge outbound delivery queue (Slack/Discord). Mirrors webhook_deliveries:
-- enqueue on room message / admin sync, deliver via platform API, retry with backoff.

CREATE TABLE IF NOT EXISTS bridge_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  bridge_id TEXT NOT NULL,
  fluxychat_message_id TEXT,
  external_channel_id TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_http_status INTEGER,
  last_error TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_deliveries_pending
  ON bridge_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_bridge_deliveries_bridge
  ON bridge_deliveries (bridge_id, created_at DESC);

-- Encrypted secrets at rest (AES-GCM, same key as webhook secrets):
-- bot token and inbound-webhook signing secret (Slack) / application public key (Discord).
ALTER TABLE bridge_configs ADD COLUMN token_ciphertext TEXT;
ALTER TABLE bridge_configs ADD COLUMN token_iv TEXT;
ALTER TABLE bridge_configs ADD COLUMN signing_secret_ciphertext TEXT;
ALTER TABLE bridge_configs ADD COLUMN signing_secret_iv TEXT;
