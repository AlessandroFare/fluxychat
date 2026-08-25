/**
 * DEPRECATED — this module used to ship fake cryptography.
 *
 * `createMlsManager` was exported publicly as "E2EE groups (MLS)" and advertised
 * the cipher suite `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`, while
 * `encryptMessage` was `btoa(plaintext)`, `decryptMessage` was `atob(...)`, the
 * `signature` field was an interpolated string, `ratchetTree` was permanently
 * empty, and `crypto.subtle` was never called. Applications that turned it on
 * transmitted and stored plaintext-in-base64 while believing their messages were
 * end-to-end encrypted.
 *
 * It is replaced by `createGroupCipher` in `./group-cipher.js`, which performs real
 * AES-256-GCM with HKDF-SHA256 per-epoch key derivation and AAD binding of
 * groupId/epoch/senderId.
 *
 * The old entry point throws instead of forwarding. Two reasons: the replacement is
 * asynchronous (WebCrypto is), and — more importantly — it requires the caller to
 * supply key material. Silently accepting the old call shape would have to invent a
 * key, which is how the original problem happened. Failing loudly with migration
 * instructions is the only safe behaviour for a security API.
 *
 * @deprecated Use `createGroupCipher({ keyMaterial })` from `@fluxy-chat/sdk`.
 */

const MIGRATION = [
  "createMlsManager() has been removed: it was not encryption.",
  "It base64-encoded the plaintext while claiming MLS, so any data it 'protected' was in the clear.",
  "",
  "Replace it with:",
  "",
  "  import { createGroupCipher } from '@fluxy-chat/sdk';",
  "",
  "  const cipher = createGroupCipher({ keyMaterial }); // base64, 32 bytes, distributed by YOUR app",
  "  const group = cipher.createGroup({ groupId });",
  "  cipher.addDevice(groupId, { deviceId });",
  "  const envelope = await cipher.encrypt(groupId, deviceId, plaintext);",
  "  const plaintext = await cipher.decrypt(groupId, envelope);",
  "",
  "encrypt/decrypt are async, and keyMaterial is required: if the key comes from a",
  "FluxyChat endpoint the server can decrypt, so the result is content encryption",
  "with server-managed keys, not end-to-end encryption. Do not advertise it as E2EE",
  "unless your application distributes the key out of band.",
].join("\n");

/** @deprecated see the module docblock; use `createGroupCipher` instead. */
export function createMlsManager(): never {
  throw new Error(MIGRATION);
}

export type {
  GroupCipher as MlsManager,
  GroupDevice as MlsDevice,
  GroupConfig as MlsGroupConfig,
  GroupEnvelope as MlsMessage,
  GroupState as MlsGroup,
  GroupCipherSuite as MlsCipherSuite,
} from "./group-cipher.js";
