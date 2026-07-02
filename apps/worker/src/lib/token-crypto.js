/**
 * P26-B2: AES-256-GCM token encryption for OAuth tokens.
 * Adapted from Vercel Chat SDK's `adapter-shared/src/crypto.ts`.
 *
 * Uses Web Crypto API (`crypto.subtle`) since this runs on Cloudflare Workers.
 * Each encryption uses a random 12-byte IV per encryption.
 * Returns base64-encoded `{ ciphertext, iv, tag }`.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96-bit IV for GCM
const KEY_LENGTH = 256; // bits
const AUTH_TAG_LENGTH = 128; // bits (16 bytes)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Base64-encode an ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string to Uint8Array.
 * @param {string} b64
 * @returns {Uint8Array}
 */
function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a string to Uint8Array (UTF-8).
 * @param {string} text
 * @returns {Uint8Array}
 */
function encodeText(text) {
  return new TextEncoder().encode(text);
}

/**
 * Decode Uint8Array to string (UTF-8).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function decodeText(bytes) {
  return new TextDecoder().decode(bytes);
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive a 256-bit AES-GCM key from a master string.
 * Uses SHA-256 to hash the master key into a 32-byte buffer,
 * then imports it as a CryptoKey.
 *
 * For stronger derivation, callers can pre-hash with PBKDF2 before passing.
 *
 * @param {string} masterKey - Master key string
 * @returns {Promise<CryptoKey>} AES-GCM CryptoKey
 */
export async function deriveKey(masterKey) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encodeText(masterKey)
  );
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

// =============================================================================
// Encryption / Decryption
// =============================================================================

/**
 * Encrypt a plaintext token using AES-256-GCM.
 *
 * @param {string} plaintext - Token to encrypt
 * @param {CryptoKey} key - AES-GCM key (from deriveKey)
 * @returns {Promise<{ciphertext: string, iv: string, tag: string}>} Base64-encoded encrypted data
 */
export async function encryptToken(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = encodeText(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    encoded
  );

  // Web Crypto returns ciphertext + auth tag concatenated
  const encrypted = new Uint8Array(encryptedBuffer);
  const tagOffset = encrypted.length - 16; // last 16 bytes = auth tag
  const ciphertext = encrypted.slice(0, tagOffset);
  const tag = encrypted.slice(tagOffset);

  return {
    ciphertext: toBase64(ciphertext.buffer),
    iv: toBase64(iv.buffer),
    tag: toBase64(tag.buffer),
  };
}

/**
 * Decrypt an encrypted token using AES-256-GCM.
 *
 * @param {{ciphertext: string, iv: string, tag: string}} encrypted - Encrypted token data
 * @param {CryptoKey} key - AES-GCM key (from deriveKey)
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptToken(encrypted, key) {
  const ciphertext = fromBase64(encrypted.ciphertext);
  const iv = fromBase64(encrypted.iv);
  const tag = fromBase64(encrypted.tag);

  // Reconstruct ciphertext + tag for Web Crypto
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    combined
  );

  return decodeText(new Uint8Array(decryptedBuffer));
}

/**
 * Type guard for EncryptedTokenData.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEncryptedTokenData(value) {
  if (!value || typeof value !== "object") return false;
  const obj = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof obj.iv === "string" &&
    typeof obj.ciphertext === "string" &&
    typeof obj.tag === "string"
  );
}

// =============================================================================
// TokenCrypto Class
// =============================================================================

/**
 * TokenCrypto wraps encrypt/decrypt with a configured master key.
 * Adapters construct one instance at init time and reuse it.
 *
 * @example
 * ```js
 * const crypto = new TokenCrypto(process.env.OAUTH_ENCRYPTION_KEY);
 * const encrypted = await crypto.encrypt("my-oauth-token");
 * // ... store encrypted ...
 * const plaintext = await crypto.decrypt(encrypted);
 * ```
 */
export class TokenCrypto {
  /** @type {string} */
  #masterKey;

  /** @type {CryptoKey|null} */
  #cryptoKey = null;

  /**
   * @param {string} masterKey - Master key string for key derivation
   */
  constructor(masterKey) {
    if (!masterKey || typeof masterKey !== "string") {
      throw new Error("TokenCrypto: masterKey is required");
    }
    this.#masterKey = masterKey;
  }

  /**
   * Lazily derive the CryptoKey.
   * @returns {Promise<CryptoKey>}
   */
  async #getKey() {
    if (!this.#cryptoKey) {
      this.#cryptoKey = await deriveKey(this.#masterKey);
    }
    return this.#cryptoKey;
  }

  /**
   * Encrypt a plaintext token.
   * @param {string} plaintext
   * @returns {Promise<{ciphertext: string, iv: string, tag: string}>}
   */
  async encrypt(plaintext) {
    const key = await this.#getKey();
    return encryptToken(plaintext, key);
  }

  /**
   * Decrypt an encrypted token.
   * @param {{ciphertext: string, iv: string, tag: string}} encrypted
   * @returns {Promise<string>}
   */
  async decrypt(encrypted) {
    const key = await this.#getKey();
    return decryptToken(encrypted, key);
  }
}
