import { keccak_256 } from "@noble/hashes/sha3.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const NONCE_TTL_MS = 10 * 60 * 1000;

function normalizeAddress(address) {
  if (typeof address !== "string") return "";
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return "";
  return trimmed.toLowerCase();
}

function nonceKey(projectId, address) {
  return `wallet-siwe:${projectId}:${address}`;
}

function allowlistKey(projectId) {
  return `wallet-allowlist:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

export function buildSiweMessage({ domain, uri, address, nonce, issuedAt, chainId = 1 }) {
  const addr = normalizeAddress(address);
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    addr,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export function hashPersonalMessage(message) {
  const enc = new TextEncoder();
  const msg = enc.encode(message);
  const prefix = enc.encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  const both = new Uint8Array(prefix.length + msg.length);
  both.set(prefix);
  both.set(msg, prefix.length);
  return keccak_256(both);
}

export function recoverPersonalSignAddress(message, signatureHex) {
  const raw = typeof signatureHex === "string" ? signatureHex.trim() : "";
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (hex.length !== 130) throw new Error("bad_signature");
  const sig = hexToBytes(hex);
  let v = sig[64];
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("bad_signature");
  // Ethereum personal_sign is r||s||v. Noble recovered is rec||r||s.
  const recovered = new Uint8Array(65);
  recovered[0] = v;
  recovered.set(sig.subarray(0, 64), 1);
  const hash = hashPersonalMessage(message);
  const pub = secp256k1.Signature.fromBytes(recovered, "recovered").recoverPublicKey(hash);
  const uncompressed = pub.toBytes(false);
  const addrBytes = keccak_256(uncompressed.slice(1)).slice(12);
  return `0x${bytesToHex(addrBytes)}`;
}

export async function issueWalletNonce(env, { projectId, address, domain, uri }) {
  const addr = normalizeAddress(address);
  if (!addr) return { error: "invalid_address", status: 400 };
  const kv = getKv(env);
  if (!kv) return { error: "kv_unavailable", status: 503 };
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const issuedAt = new Date().toISOString();
  const message = buildSiweMessage({ domain, uri, address: addr, nonce, issuedAt });
  await kv.put(nonceKey(projectId, addr), JSON.stringify({ nonce, issuedAt, message }), {
    expirationTtl: Math.ceil(NONCE_TTL_MS / 1000),
  });
  return { nonce, issuedAt, message, address: addr };
}

export async function verifyWalletSiwe(env, { projectId, address, message, signature, domain }) {
  const addr = normalizeAddress(address);
  if (!addr) return { error: "invalid_address", status: 400 };
  if (typeof message !== "string" || !message.includes(addr)) {
    return { error: "invalid_message", status: 400 };
  }
  if (domain && !message.startsWith(`${domain} wants you to sign in`)) {
    return { error: "invalid_domain", status: 400 };
  }
  const kv = getKv(env);
  if (!kv) return { error: "kv_unavailable", status: 503 };
  const raw = await kv.get(nonceKey(projectId, addr));
  if (!raw) return { error: "nonce_expired", status: 401 };
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    return { error: "nonce_expired", status: 401 };
  }
  if (stored.message !== message) return { error: "message_mismatch", status: 401 };
  let recovered;
  try {
    recovered = recoverPersonalSignAddress(message, signature);
  } catch {
    return { error: "bad_signature", status: 401 };
  }
  if (recovered !== addr) return { error: "address_mismatch", status: 401 };
  const gate = await assertWalletAllowlisted(env, projectId, addr);
  if (gate.error) return gate;
  await kv.delete(nonceKey(projectId, addr));
  return { address: addr };
}

export async function getWalletAllowlist(env, projectId) {
  const kv = getKv(env);
  if (!kv) return { addresses: [] };
  const raw = await kv.get(allowlistKey(projectId));
  if (!raw) return { addresses: [] };
  try {
    const parsed = JSON.parse(raw);
    return { addresses: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { addresses: [] };
  }
}

export async function setWalletAllowlist(env, projectId, addresses) {
  const kv = getKv(env);
  if (!kv) return { error: "kv_unavailable", status: 503 };
  const next = (Array.isArray(addresses) ? addresses : [])
    .map((item) => normalizeAddress(item))
    .filter(Boolean)
    .slice(0, 500);
  await kv.put(allowlistKey(projectId), JSON.stringify(next));
  return { addresses: next };
}

export async function assertWalletAllowlisted(env, projectId, address) {
  const { addresses } = await getWalletAllowlist(env, projectId);
  if (addresses.length === 0) return { ok: true };
  if (!addresses.includes(address)) return { error: "not_allowlisted", status: 403 };
  return { ok: true };
}

export async function mintWalletMemberJwt(env, { projectId, address, signJwtHs256, ttlSeconds = 3600 }) {
  const row = await env.DB.prepare("SELECT jwt_secret FROM project_secrets WHERE project_id = ?")
    .bind(projectId)
    .first();
  if (!row?.jwt_secret) return { error: "project secret not configured", status: 400 };
  const ttl = Math.max(60, Math.min(Number(ttlSeconds || 3600), 86_400));
  const token = await signJwtHs256(row.jwt_secret, {
    sub: address,
    tid: projectId,
    roles: ["member"],
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttl,
  });
  return {
    token,
    expiresIn: ttl,
    userId: address,
    projectId,
    claims: { sub: address, tid: projectId, roles: ["member"] },
  };
}
