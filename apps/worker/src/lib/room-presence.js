/**
 * Pusher-style presence helpers for Room DO.
 */

/**
 * @param {Map<WebSocket, string>} userIds
 * @param {Map<string, number>} userConnectionCounts
 * @returns {string[]}
 */
export function listActivePresenceUserIds(userIds, userConnectionCounts) {
  const fromCounts = [...userConnectionCounts.keys()];
  if (fromCounts.length) return fromCounts;
  return [...new Set([...userIds.values()].filter((uid) => !String(uid).startsWith("recovered:")))];
}

/**
 * @param {string[]} userIds
 * @param {Map<string, Record<string, unknown>>} userInfoByUserId
 */
export function buildPresenceMembers(userIds, userInfoByUserId) {
  return userIds.map((userId) => ({
    userId,
    userInfo: userInfoByUserId.get(userId) ?? {},
  }));
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function parsePresenceInfoParam(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return {};
  if (raw.length > 2048) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Audit S-22: only accept a small, well-typed allowlist of presence
    // fields. This prevents an attacker from broadcasting arbitrary
    // attacker-controlled strings (e.g. with HTML) to every room member.
    const out = {};
    if (typeof parsed.name === "string" && parsed.name.length <= 64) {
      out.name = parsed.name;
    }
    if (typeof parsed.avatar_url === "string" && /^https?:\/\//.test(parsed.avatar_url)) {
      out.avatar_url = parsed.avatar_url;
    }
    if (typeof parsed.role === "string" && parsed.role.length <= 32) {
      out.role = parsed.role;
    }
    return out;
  } catch {
    return {};
  }
}

const CLIENT_EVENT_PREFIX = "client-";
const CLIENT_EVENT_MAX_PER_MINUTE = 10;

/**
 * @param {string} eventName
 * @returns {{ ok: true, eventName: string } | { ok: false, error: string }}
 */
export function normalizeClientEventName(eventName) {
  const name = String(eventName ?? "").trim();
  if (!name) return { ok: false, error: "eventName required" };
  if (!name.startsWith(CLIENT_EVENT_PREFIX)) {
    return { ok: false, error: "client events must be prefixed with client-" };
  }
  if (name.length > 128) return { ok: false, error: "eventName too long" };
  if (!/^client-[a-zA-Z0-9_.-]+$/.test(name)) {
    return { ok: false, error: "invalid client event name" };
  }
  return { ok: true, eventName: name };
}

/** Live cursors are ephemeral fan-out (no D1, no webhooks). ~10 updates/sec. */
export const CURSOR_MAX_PER_MINUTE = 600;

const PRESENCE_PATCH_MAX_BYTES = 2048;
const SELECTION_TEXT_MAX = 512;

function clampCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-1e6, Math.min(1e6, n));
}

function sanitizeSelection(raw) {
  if (raw === null) return { ok: true, selection: null };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "presence_selection_invalid" };
  }
  const selection = {};
  if (typeof raw.kind === "string" && raw.kind.length <= 32) {
    selection.kind = raw.kind.slice(0, 32);
  }
  for (const key of ["x", "y", "x2", "y2"]) {
    if (raw[key] != null) {
      const n = clampCoord(raw[key]);
      if (n == null) return { ok: false, error: "presence_selection_invalid" };
      selection[key] = n;
    }
  }
  if (typeof raw.text === "string") {
    selection.text = raw.text.slice(0, SELECTION_TEXT_MAX);
  }
  return { ok: true, selection };
}

/**
 * Allowlisted presence JSON (cursor + selection). No HTML, size-capped.
 * @param {unknown} raw
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, error: string }}
 */
export function sanitizePresencePatch(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) && raw.data && typeof raw.data === "object"
    ? raw.data
    : raw;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, error: "presence_patch_invalid" };
  }
  const data = {};
  if ("cursor" in source) {
    if (source.cursor === null) {
      data.cursor = null;
    } else if (source.cursor && typeof source.cursor === "object") {
      const x = clampCoord(source.cursor.x);
      const y = clampCoord(source.cursor.y);
      if (x == null || y == null) return { ok: false, error: "presence_cursor_invalid" };
      data.cursor = { x, y };
    } else {
      return { ok: false, error: "presence_cursor_invalid" };
    }
  }
  if ("selection" in source) {
    const sel = sanitizeSelection(source.selection);
    if (!sel.ok) return sel;
    data.selection = sel.selection;
  }
  if ("agentStatus" in source) {
    if (source.agentStatus === null) {
      data.agentStatus = null;
    } else if (typeof source.agentStatus === "string") {
      data.agentStatus = source.agentStatus.replace(/[<>]/g, "").slice(0, 64);
    } else {
      return { ok: false, error: "presence_agent_status_invalid" };
    }
  }
  const encoded = JSON.stringify(data);
  if (encoded.length > PRESENCE_PATCH_MAX_BYTES) {
    return { ok: false, error: "presence_patch_too_large" };
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "presence_patch_empty" };
  return { ok: true, data };
}

/** Sparse broadcast that must not hit tenant webhooks. */
export function shouldSkipClientEventWebhook(eventName) {
  return String(eventName || "").startsWith("client-ephemeral-");
}

export { CLIENT_EVENT_MAX_PER_MINUTE };
