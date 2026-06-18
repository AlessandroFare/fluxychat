-- Audit S-11: migrate API key hashing from SHA-256 to HMAC-SHA-256.
-- Adds a new column `key_hmac` alongside the legacy `key_hash`. Resolution
-- checks both; new keys are written with the HMAC, old keys continue to work
-- until `key_hash` is backfilled and dropped (P1 follow-up migration).

ALTER TABLE api_keys ADD COLUMN key_hmac TEXT;
CREATE INDEX IF NOT EXISTS idx_api_keys_hmac ON api_keys (key_hmac);

-- Audit S-28: clear out any legacy plaintext API keys stored in `secret`.
-- New keys are no longer written there; the column is left in place for
-- compatibility with old imports but is empty for new rows.
UPDATE api_keys SET secret = '' WHERE secret IS NOT NULL AND secret != '';
