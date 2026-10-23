import { OPS_GUEST_CAN } from "./ops-policy.js";

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, text) {
  // OPS-05: never fall back to a fixed key — an unset secret would make every
  // guest token forgeable. Fail closed instead.
  if (!secret) throw new Error("ops_guest_secret_unconfigured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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

export async function redeemOpsGuestInvite(store, { projectId, token, secret, consume = false }) {
  const tokenHash = await hmac(secret, token);
  const guest = await store.getGuestByTokenHash(projectId, tokenHash);
  if (!guest) return { ok: false, error: "invalid_invite" };
  if (Date.parse(guest.expiresAt) < Date.now()) return { ok: false, error: "expired" };
  // Audit F-88: entering via the invite link is single-use; the claim is atomic
  // so two concurrent redemptions cannot both succeed. Per-action checks keep
  // working with the token until expiry.
  if (consume) {
    const claimed = await store.markGuestRedeemed(projectId, guest.id);
    if (!claimed) return { ok: false, error: "invite_already_used" };
  }
  return { ok: true, guest, can: guest.scope };
}

export function guestMay(guest, action) {
  return Boolean(guest?.scope?.includes(action) && OPS_GUEST_CAN.includes(action));
}
