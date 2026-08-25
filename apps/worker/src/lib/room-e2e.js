import { encryptSecret, decryptSecret } from "./secrets-crypto.js";

const ROOM_CONTENT_KEY_BYTES = 32;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * @returns {string} base64-encoded 32-byte AES key for client room content envelopes.
 */
export function generateRoomContentKeyMaterial() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(ROOM_CONTENT_KEY_BYTES)));
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string} keyMaterial base64 key returned to clients
 */
export async function encryptRoomContentKeyForStorage(env, keyMaterial) {
  return encryptSecret(env, keyMaterial);
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string | null | undefined} ciphertext
 * @param {string | null | undefined} iv
 * @returns {Promise<string | null>}
 */
export async function decryptRoomContentKeyFromStorage(env, ciphertext, iv) {
  return decryptSecret(env, ciphertext, iv);
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
export function isRoomContentEnvelope(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2e === 1 && typeof parsed.c === "string" && typeof parsed.iv === "string";
  } catch {
    return false;
  }
}