function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function getSecretsEncryptionKey(env) {
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

export async function encryptSecret(env, secret) {
  const key = await getSecretsEncryptionKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptSecret(env, ciphertext, iv) {
  const key = await getSecretsEncryptionKey(env);
  if (!key || !ciphertext || !iv) return null;
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(String(iv)) },
      key,
      base64ToBytes(String(ciphertext))
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function maskSecretPreview(secret) {
  if (!secret || secret.length < 8) return "••••";
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
