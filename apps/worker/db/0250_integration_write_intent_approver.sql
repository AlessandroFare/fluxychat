-- Audit F-24: maker-checker for integration write intents.
ALTER TABLE integration_write_intents ADD COLUMN approved_by TEXT;
