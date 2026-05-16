function bytesToBase64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function getWebhookEncryptionKey(env) {
  const raw = String(env.WEBHOOK_SECRET_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  try {
    const keyBytes = base64ToBytes(raw);
    if (keyBytes.byteLength !== 32) return null;
    return await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

/** Local/dev only — set ALLOW_PLAINTEXT_WEBHOOK_SECRETS=true in .dev.vars. */
export function isPlaintextWebhookSecretAllowed(env) {
  return String(env.ALLOW_PLAINTEXT_WEBHOOK_SECRETS || "").trim() === "true";
}

/** When true, webhook register/update with a secret requires WEBHOOK_SECRET_ENCRYPTION_KEY. */
export function isWebhookSecretEncryptionRequired(env) {
  if (String(env.REQUIRE_WEBHOOK_SECRET_ENCRYPTION || "").trim() === "true") {
    return true;
  }
  if (isPlaintextWebhookSecretAllowed(env)) {
    return false;
  }
  return true;
}

/**
 * @param {object} env
 * @param {string} secret
 * @param {(plain: string) => Promise<string>} hashSecret
 * @returns {Promise<{
 *   ok: boolean,
 *   error?: string,
 *   message?: string,
 *   secretHash?: string|null,
 *   enc?: { secretCiphertext: string, secretIv: string }|null,
 *   secretPlain?: string|null,
 *   warning?: string|null,
 * }>}
 */
export async function prepareWebhookSecretForStorage(env, secret, hashSecret) {
  const trimmed = typeof secret === "string" ? secret.trim() : "";
  if (!trimmed) {
    return {
      ok: true,
      secretHash: null,
      enc: null,
      secretPlain: null,
      warning: null,
    };
  }

  const secretHash = await hashSecret(trimmed);
  const enc = await encryptWebhookSecret(env, trimmed);
  if (enc) {
    return {
      ok: true,
      secretHash,
      enc,
      secretPlain: null,
      warning: null,
    };
  }

  if (isWebhookSecretEncryptionRequired(env)) {
    return {
      ok: false,
      error: "webhook_secret_encryption_required",
      message:
        "WEBHOOK_SECRET_ENCRYPTION_KEY is required to store signing secrets. Set a 32-byte base64 key, or ALLOW_PLAINTEXT_WEBHOOK_SECRETS=true for local dev only.",
    };
  }

  return {
    ok: true,
    secretHash,
    enc: null,
    secretPlain: trimmed,
    warning: "webhook_secret_stored_plaintext",
  };
}

export async function encryptWebhookSecret(env, secret) {
  const key = await getWebhookEncryptionKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret)
  );
  return {
    secretCiphertext: bytesToBase64(new Uint8Array(ct)),
    secretIv: bytesToBase64(iv),
  };
}

/** True when the webhook row was configured to sign outbound deliveries. */
export function webhookRequiresSigningSecret(row) {
  return Boolean(
    row?.secret_hash ||
      (row?.secret_ciphertext && row?.secret_iv) ||
      (row?.secret != null && String(row.secret).trim())
  );
}

/** @returns {{ secret: string | null, fatalError: string | null }} */
export async function resolveWebhookSigningSecret(env, row) {
  const plain =
    row?.secret != null && String(row.secret).trim()
      ? String(row.secret).trim()
      : "";
  const hasCiphertext = !!(row?.secret_ciphertext && row?.secret_iv);

  if (hasCiphertext) {
    const key = await getWebhookEncryptionKey(env);
    if (!key) {
      return { secret: null, fatalError: "encryption_key_missing" };
    }
    try {
      const iv = base64ToBytes(String(row.secret_iv));
      const ct = base64ToBytes(String(row.secret_ciphertext));
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return { secret: new TextDecoder().decode(pt), fatalError: null };
    } catch {
      return { secret: null, fatalError: "secret_decrypt_failure" };
    }
  }

  if (plain) {
    return { secret: plain, fatalError: null };
  }

  return { secret: null, fatalError: null };
}

export async function signWebhookPayload(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}
