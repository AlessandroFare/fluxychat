-- Migration 0138: force-rotation of pre-HMAC API keys.
--
-- Audit S-11 backfill: we cannot retroactively HMAC an unknown raw key
-- (the `secret` column was cleared in 0137; even if it had not been,
-- the HMAC is computed over the original plaintext, which we no longer
-- have for keys minted before this fix). Marking existing rows revoked
-- forces a re-mint and ensures the legacy column can be dropped without
-- losing any working key — the only key an operator will lose is one
-- they should have rotated at the cutover.
--
-- If you are running this on a live deployment with thousands of keys,
-- contact the maintainers: a dedicated rollover migration is required.

UPDATE api_keys
SET revoked_at = COALESCE(revoked_at, datetime('now'))
WHERE key_hmac IS NULL OR key_hmac = '';
