import { encryptSecret, decryptSecret } from "./secrets-crypto.js";

const E2E_KEY_BYTES = 32;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * @returns {string} base64-encoded 32-byte AES key for client E2E envelopes.
 */
export function generateRoomE2eKeyMaterial() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(E2E_KEY_BYTES)));
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string} keyMaterial base64 key returned to clients
 */
export async function encryptRoomE2eKeyForStorage(env, keyMaterial) {
  return encryptSecret(env, keyMaterial);
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string | null | undefined} ciphertext
 * @param {string | null | undefined} iv
 * @returns {Promise<string | null>}
 */
export async function decryptRoomE2eKeyFromStorage(env, ciphertext, iv) {
  return decryptSecret(env, ciphertext, iv);
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
export function isE2eContentEnvelope(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2e === 1 && typeof parsed.c === "string" && typeof parsed.iv === "string";
  } catch {
    return false;
  }
}
