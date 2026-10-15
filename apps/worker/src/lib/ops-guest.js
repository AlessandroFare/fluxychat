import { OPS_GUEST_CAN } from "./ops-policy.js";

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || "ops-guest"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return hex(sig);
}

export async function issueOpsGuestInvite(store, { projectId, runId, email, can, expiresAt, secret }) {
  const scope = (can || ["comment"]).filter((item) => OPS_GUEST_CAN.includes(item));
  const token = `${projectId}.${runId}.${crypto.randomUUID()}`;
  const tokenHash = await hmac(secret, token);
  const guest = await store.createGuest({
    projectId,
    runId,
    email,
    scope,
    tokenHash,
    expiresAt: expiresAt || new Date(Date.now() + 5 * 86_400_000).toISOString(),
  });
  return { guest, token, can: scope };
}

export async function redeemOpsGuestInvite(store, { projectId, token, secret }) {
  const tokenHash = await hmac(secret, token);
  const guest = await store.getGuestByTokenHash(projectId, tokenHash);
  if (!guest) return { ok: false, error: "invalid_invite" };
  if (Date.parse(guest.expiresAt) < Date.now()) return { ok: false, error: "expired" };
  return { ok: true, guest, can: guest.scope };
}

export function guestMay(guest, action) {
  return Boolean(guest?.scope?.includes(action) && OPS_GUEST_CAN.includes(action));
}
