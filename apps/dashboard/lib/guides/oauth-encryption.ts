import type { GuideContent } from "@/lib/guides/types";

export const OAUTH_ENCRYPTION_GUIDE: GuideContent = {
  title: "OAuth token encryption at rest",
  subtitle:
    "Encrypt stored OAuth tokens with AES-256-GCM using the FluxyChat TokenCrypto utility.",
  sections: [
    {
      id: "overview",
      title: "Why encrypt OAuth tokens?",
      paragraphs: [
        "When your FluxyChat adapters store OAuth tokens (e.g., Slack, Discord, Telegram bot tokens), they need to be encrypted at rest. Storing plaintext tokens in D1 means a database leak exposes all connected accounts.",
        "FluxyChat provides AES-256-GCM token encryption via the TokenCrypto class in the SDK, using Web Crypto API (works on Workers, browsers, and Node.js 19+).",
      ],
    },
    {
      id: "usage",
      title: "Using TokenCrypto",
      paragraphs: [
        "Create a TokenCrypto instance with a master key, then encrypt tokens before storing them and decrypt when needed.",
      ],
      code: `import { TokenCrypto } from "@fluxy-chat/sdk";

const crypto = new TokenCrypto(process.env.OAUTH_ENCRYPTION_KEY);

// Encrypt before storing
const encrypted = await crypto.encrypt("xoxb-slack-token-here");
// Store encrypted.ciphertext, encrypted.iv, encrypted.tag in D1

// Decrypt when needed
const plaintext = await crypto.decrypt(encrypted);`,
    },
    {
      id: "key-derivation",
      title: "Key derivation",
      paragraphs: [
        "TokenCrypto derives the AES key by SHA-256 hashing the master key string. For stronger derivation, pre-hash with PBKDF2 before passing to TokenCrypto.",
        "Generate a strong master key: use 32+ random bytes, base64-encode. Store it as a worker secret (never in wrangler.toml).",
      ],
      code: `// Generate a key
const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
console.log(key); // base64-encoded 32 bytes`,
    },
    {
      id: "rotation",
      title: "Rotating the encryption key",
      bullets: [
        "Decrypt all tokens with the old key",
        "Re-encrypt with the new key",
        "Store the new key as a worker secret",
        "Keep the old key until all tokens are migrated",
        "Use the SDK's isEncryptedTokenData() to detect already-encrypted tokens",
      ],
    },
  ],
  seoTopics: ["oauth encryption", "aes-256-gcm", "token crypto", "encryption at rest", "security"],
};
