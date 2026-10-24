-- Migration 0246 (audit #28): secret API keys (fc_) must never be recoverable
-- from the database. Legacy rows stored the plaintext key as `id`; rewrite them
-- to opaque ids.
--
-- Safe: auth matches key_hash/key_hmac (resolve-project-id.ts), and
-- revoke-before-rotate now filters key_prefix (with id only for pre-migration
-- rows). key_prefix is backfilled first so prefix-based filters keep matching
-- after the scrub.
--
-- Publishable keys (pk_) keep their recoverable id by design: pk_ is a public
-- browser-side identifier (guest-session/anonymous tokens only; see
-- api-key-kind.js and assertSecretApiKey).
UPDATE api_keys
   SET key_prefix = COALESCE(key_prefix, substr(id, 1, 8))
 WHERE key_prefix IS NULL
   AND (id LIKE 'fc_%' OR id LIKE 'pk_%');

UPDATE api_keys
   SET id = 'key_' || lower(hex(randomblob(16)))
 WHERE id LIKE 'fc_%';
