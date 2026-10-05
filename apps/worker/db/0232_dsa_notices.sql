CREATE TABLE IF NOT EXISTS dsa_notices (
  id TEXT PRIMARY KEY,
  explanation TEXT NOT NULL,
  content_url TEXT NOT NULL,
  contact TEXT NOT NULL,
  share_token TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  restriction_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dsa_notices_status ON dsa_notices(status, created_at);
