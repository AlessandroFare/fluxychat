# Webhook Secret Encryption Migration

This guide covers migrating existing plaintext webhook secrets to AES-GCM-encrypted values once `WEBHOOK_SECRET_ENCRYPTION_KEY` is configured.

## Background

When `WEBHOOK_SECRET_ENCRYPTION_KEY` is **absent**, new webhooks created via `POST /webhooks/register` store their secret in plaintext (the `secret` column, with `secret_ciphertext`/`secret_iv` left NULL). This is a deployment safety net — the worker continues to function without the key, but secrets are stored in the clear.

Once the key is provisioned, existing plaintext rows should be encrypted to eliminate the plaintext surface.

## Prerequisites

1. `WEBHOOK_SECRET_ENCRYPTION_KEY` is set in your Cloudflare Workers environment (or `.dev.vars` for local/dev).
2. The key is a **32-byte hex string** (64 hex chars) or a **raw 32-byte base64 string** (43 base64 chars). Generate with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Backup your D1 database before running any migration SQL.

## Migration: Encrypt existing plaintext secrets

### Step 1 — Identify plaintext rows

```sql
-- Preview: list all webhooks that have plaintext secrets
SELECT id, project_id, url, secret, created_at
FROM webhooks
WHERE secret IS NOT NULL AND (secret_ciphertext IS NULL OR secret_iv IS NULL);
```

Count the rows. If the count is 0, no migration is needed.

### Step 2 — Encrypt and update

For each row from Step 1, encrypt the secret using the worker logic and update the row:

```sql
UPDATE webhooks
SET
  secret = NULL,
  secret_ciphertext = '<base64_ciphertext>',
  secret_iv = '<base64_iv>'
WHERE id = '<webhook_id>';
```

To encrypt, use the worker itself. Run a wrangler dev session:

```js
// Encrypt a secret using the same logic the worker uses
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(process.env.WEBHOOK_SECRET_ENCRYPTION_KEY),
  { name: "AES-GCM" },
  false,
  ["encrypt"]
);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  new TextEncoder().encode(secret)
);
const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ct)));
const ivB64 = btoa(String.fromCharCode(...iv));
// Then UPDATE webhooks SET secret = NULL, secret_ciphertext = '<ciphertext>', secret_iv = '<iv>' WHERE id = '<id>';
```

Or add a dedicated admin route in the worker:

```js
// POST /admin/encrypt-webhook-secrets (requires admin auth)
const rows = await env.DB.prepare(
  "SELECT id, secret FROM webhooks WHERE secret IS NOT NULL AND secret_ciphertext IS NULL"
).all();
for (const row of rows.results || []) {
  const enc = await encryptWebhookSecret(env, row.secret);
  if (enc) {
    await env.DB.prepare(
      "UPDATE webhooks SET secret = NULL, secret_ciphertext = ?, secret_iv = ? WHERE id = ?"
    ).bind(enc.secretCiphertext, enc.secretIv, row.id).run();
  }
}
```

## Verification

After migration, verify no plaintext secrets remain:

```sql
SELECT COUNT(*) AS plaintext_count
FROM webhooks
WHERE secret IS NOT NULL AND (secret_ciphertext IS NULL OR secret_iv IS NULL);
```

Expected result: `0`.

Also verify webhook deliveries are still signed by checking for the `X-Fluxy-Signature` header on a test delivery.

## Rollback (if needed)

If a row was updated incorrectly, restore the plaintext:

```sql
UPDATE webhooks
SET secret = '<plaintext_secret>', secret_ciphertext = NULL, secret_iv = NULL
WHERE id = '<webhook_id>';
```

## Security notes

- After migration, the `secret` column is NULL for all rows — the delivery path no longer falls back to plaintext.
- If `WEBHOOK_SECRET_ENCRYPTION_KEY` is rotated, a new migration must re-encrypt all rows. Old keys cannot decrypt rows encrypted with a rotated key.