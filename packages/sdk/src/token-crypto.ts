/**
 * P26-B2: Token encryption for OAuth tokens — SDK export.
 *
 * Re-exports the Web Crypto API-based AES-256-GCM token encryption
 * so SDK consumers can use it.
 *
 * Uses `crypto.subtle` (Web Crypto API) — works on Cloudflare Workers,
 * browsers, and Node.js >= 19.
 */

export {
  encryptToken,
  decryptToken,
  deriveKey,
  isEncryptedTokenData,
  TokenCrypto,
} from "./token-crypto-impl.js";

export type { EncryptedTokenData } from "./token-crypto-impl.js";
