-- Optional at-rest encryption for webhook secrets (plaintext secret column can be null).
-- When WEBHOOK_SECRET_ENCRYPTION_KEY is configured, the worker stores AES-GCM ciphertext + IV.
-- Delivery decrypts on the fly for HMAC signing.

ALTER TABLE webhooks ADD COLUMN secret_ciphertext TEXT;
ALTER TABLE webhooks ADD COLUMN secret_iv TEXT;

