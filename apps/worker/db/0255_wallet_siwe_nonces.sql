-- Audit F-36: SIWE nonces move to D1 so verification can claim them atomically
-- (single-use; a KV read-then-delete let concurrent replays both pass).
CREATE TABLE IF NOT EXISTS wallet_siwe_nonces (
  project_id TEXT NOT NULL,
  address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (project_id, address)
);
