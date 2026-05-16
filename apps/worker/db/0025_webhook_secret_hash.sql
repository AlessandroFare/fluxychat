-- Add secret_hash to webhooks table for verification without plaintext exposure
-- Remove webhook_secret from webhook_deliveries (look up from webhooks table at delivery time)

ALTER TABLE webhooks ADD COLUMN secret_hash TEXT;

-- webhook_deliveries.webhook_secret is a security risk (plaintext in queue)
-- We'll stop writing to it; existing rows will be migrated by looking up webhooks.secret
