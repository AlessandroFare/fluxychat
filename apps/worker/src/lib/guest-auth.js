/**
 * Guest-only JWT helpers (P10-SB6).
 */

const MEMBER_PLUS_ROLES = ["member", "owner", "admin", "mod", "moderator", "bot"];

/**
 * @param {{ roles?: string[] } | null | undefined} auth
 */
export function isGuestOnlyAuth(auth) {
  if (!auth?.roles?.length) return false;
  const roles = auth.roles;
  const isGuest = roles.includes("guest");
  const hasMemberPlus = roles.some((r) => MEMBER_PLUS_ROLES.includes(r));
  return isGuest && !hasMemberPlus;
}

/**
 * @param {*} env
 */
export function isPublicGuestEnabled(env) {
  return env.PUBLIC_GUEST_ENABLED === "true" || env.PUBLIC_GUEST_ENABLED === "1";
}

/**
 * @param {*} env
 */
export function isPublicGuestReadOnly(env) {
  const v = String(env?.PUBLIC_GUEST_READ_ONLY ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * @param {*} env
 * @param {{ roles?: string[] } | null | undefined} auth
 * @returns {{ ok: true } | { ok: false, error: string, status: number }}
 */
export function assertGuestCanWrite(env, auth) {
  if (!isGuestOnlyAuth(auth)) return { ok: true };
  if (isPublicGuestReadOnly(env)) {
    return { ok: false, error: "guest_read_only", status: 403 };
  }
  return { ok: true };
}

/**
 * @param {{ roles?: string[] } | null | undefined} auth
 */
export function guestMemberRoleForJoin(auth) {
  return isGuestOnlyAuth(auth) ? "guest" : "member";
}
