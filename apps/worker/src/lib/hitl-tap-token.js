import { art50Secret } from "./art-50-mark.js";

function hexFromBuffer(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return hexFromBuffer(mac);
}

export async function signHitlTapToken(secret, { approvalId, action, userId, exp, jti, payloadHash }) {
  if (!secret) return null;
  const payload = JSON.stringify({
    approvalId,
    action,
    userId,
    exp,
    jti: jti || crypto.randomUUID(),
    payloadHash: payloadHash || "",
  });
  const sig = await hmacHex(secret, payload);
  return `${b64url(payload)}.${sig}`;
}

export async function verifyHitlTapToken(secret, token) {
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.lastIndexOf(".");
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payloadStr;
  try {
    payloadStr = fromB64url(payloadB64);
  } catch {
    return null;
  }
  const expected = await hmacHex(secret, payloadStr);
  if (!timingSafeEqualHex(expected, sig)) return null;
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return null;
  }
  if (Number(payload.exp) < Date.now()) return null;
  if (payload.action !== "approve" && payload.action !== "deny") return null;
  if (!payload.approvalId || !payload.userId || !payload.jti) return null;
  if (typeof payload.payloadHash !== "string") return null;
  return payload;
}

export async function consumeHitlTapNonce(env, jti) {
  if (!env?.DB || !jti) return { ok: false, error: "nonce_store_missing" };
  try {
    await env.DB.prepare("INSERT INTO hitl_tap_nonces (jti, used_at) VALUES (?, ?)").bind(
      String(jti),
      new Date().toISOString(),
    ).run();
    return { ok: true };
  } catch {
    return { ok: false, error: "token_already_used" };
  }
}

export function hitlTapSecret(env) {
  return art50Secret(env);
}
