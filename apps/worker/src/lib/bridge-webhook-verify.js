/**
 * Inbound bridge webhook signature verification.
 * Slack: HMAC-SHA256 ("v0:{timestamp}:{body}") + timestamp freshness.
 * Discord: Ed25519 over "{timestamp}{body}" with the application public key.
 */

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex) {
  const clean = String(hex || "").trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const SLACK_MAX_SKEW_MS = 5 * 60 * 1000;

function constantTimeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function verifySlackSignature({ signingSecret, timestamp, signature, rawBody, nowMs = Date.now() }) {
  if (!signingSecret) return { ok: false, error: "signature_not_configured" };
  if (!timestamp || !signature) return { ok: false, error: "missing_signature" };
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > SLACK_MAX_SKEW_MS) {
    return { ok: false, error: "stale_timestamp" };
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${rawBody}`));
  const expected = `v0=${bytesToHex(new Uint8Array(mac))}`;
  return constantTimeEqual(expected, signature) ? { ok: true } : { ok: false, error: "bad_signature" };
}

export async function verifyDiscordSignature({ publicKey, timestamp, signature, rawBody }) {
  if (!publicKey) return { ok: false, error: "signature_not_configured" };
  if (!timestamp || !signature) return { ok: false, error: "missing_signature" };
  const keyBytes = hexToBytes(publicKey);
  const sigBytes = hexToBytes(signature);
  if (!keyBytes || !sigBytes) return { ok: false, error: "bad_signature" };
  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      sigBytes,
      new TextEncoder().encode(`${timestamp}${rawBody}`),
    );
    return ok ? { ok: true } : { ok: false, error: "bad_signature" };
  } catch {
    return { ok: false, error: "bad_signature" };
  }
}
