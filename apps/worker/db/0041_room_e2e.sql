-- Optional room-level E2E payload encryption (key distributed to members via GET /rooms/:id/e2e-key).
ALTER TABLE rooms ADD COLUMN e2e_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN e2e_key_ciphertext TEXT;
ALTER TABLE rooms ADD COLUMN e2e_key_iv TEXT;
