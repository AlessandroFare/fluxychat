-- Complete secret_hash migration:
-- - webhook_deliveries.webhook_secret column removed (already writing null since 0025)
-- - Plaintext secret kept in webhooks table for HMAC signing at delivery time
-- - API responses never return secret after creation
-- - secret_hash used for verification endpoint

ALTER TABLE webhook_deliveries DROP COLUMN webhook_secret;
