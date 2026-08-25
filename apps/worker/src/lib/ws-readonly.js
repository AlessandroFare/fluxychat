/**
 * Readonly / spectator room WebSockets (CF-A-023).
 * The socket still receives broadcasts; mutating client frames are rejected.
 */

export const READONLY_ALLOWED_CLIENT_TYPES = new Set(["ping", "resume"]);

export const SPECTATOR_ROLE_NAMES = new Set(["spectator", "viewer", "readonly"]);

export function parseReadonlyConnectParam(param) {
  const v = String(param ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "readonly";
}

export function hasSpectatorRole(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((role) => SPECTATOR_ROLE_NAMES.has(String(role).toLowerCase()));
}

/**
 * Query `readonly=1` / `mode=readonly`, JWT spectator roles, or authz `publish: false`.
 */
export function isReadonlyWsConnect({ queryReadonly, queryMode, roles, capabilities } = {}) {
  if (parseReadonlyConnectParam(queryReadonly)) return true;
  const mode = String(queryMode ?? "").trim().toLowerCase();
  if (mode === "readonly" || mode === "spectator") return true;
  if (hasSpectatorRole(roles)) return true;
  if (capabilities && capabilities.publish === false) return true;
  return false;
}

export function isReadonlyAllowedClientType(type) {
  return READONLY_ALLOWED_CLIENT_TYPES.has(String(type || ""));
}

export function readonlyConnectionError() {
  return { type: "error", message: "readonly_connection" };
}
