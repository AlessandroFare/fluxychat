/**
 * P26-B2: Token encryption for OAuth tokens — SDK copy.
 *
 * AES-256-GCM token encryption using Web Crypto API.
 * Works on Cloudflare Workers, browsers, and Node.js >= 19.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const AUTH_TAG_LENGTH = 128;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export interface EncryptedTokenData {
  ciphertext: string;
  iv: string;
  tag: string;
}

export async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const data = encodeText(masterKey);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data.buffer as ArrayBuffer,
  );
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptToken(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedTokenData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = encodeText(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource, tagLength: AUTH_TAG_LENGTH },
    key,
    encoded.buffer as ArrayBuffer,
  );

  const encrypted = new Uint8Array(encryptedBuffer);
  const tagOffset = encrypted.length - 16;
  const ciphertext = encrypted.slice(0, tagOffset);
  const tag = encrypted.slice(tagOffset);

  return {
    ciphertext: toBase64(ciphertext.buffer),
    iv: toBase64(iv.buffer),
    tag: toBase64(tag.buffer),
  };
}

export async function decryptToken(
  encrypted: EncryptedTokenData,
  key: CryptoKey,
): Promise<string> {
  const ciphertext = fromBase64(encrypted.ciphertext);
  const iv = fromBase64(encrypted.iv);
  const tag = fromBase64(encrypted.tag);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource, tagLength: AUTH_TAG_LENGTH },
    key,
    combined.buffer as ArrayBuffer,
  );

  return decodeText(new Uint8Array(decryptedBuffer));
}

export function isEncryptedTokenData(value: unknown): value is EncryptedTokenData {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.iv === "string" &&
    typeof obj.ciphertext === "string" &&
    typeof obj.tag === "string"
  );
}

export class TokenCrypto {
  #masterKey: string;
  #cryptoKey: CryptoKey | null = null;

  constructor(masterKey: string) {
    if (!masterKey || typeof masterKey !== "string") {
      throw new Error("TokenCrypto: masterKey is required");
    }
    this.#masterKey = masterKey;
  }

  async #getKey(): Promise<CryptoKey> {
    if (!this.#cryptoKey) {
      this.#cryptoKey = await deriveKey(this.#masterKey);
    }
    return this.#cryptoKey;
  }

  async encrypt(plaintext: string): Promise<EncryptedTokenData> {
    const key = await this.#getKey();
    return encryptToken(plaintext, key);
  }

  async decrypt(encrypted: EncryptedTokenData): Promise<string> {
    const key = await this.#getKey();
    return decryptToken(encrypted, key);
  }
}
