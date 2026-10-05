/**
 * Default shared-room agent guard (Willison “lethal trifecta”).
 * Public docs: no attack recipes. Tests use synthetic markers only.
 */

import { isGuestOnlyAuth } from "./guest-auth.js";

const HIDDEN_CHARS_RE =
  /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\u3164]/g;

const EXTERNAL_TOOL_RE =
  /^(https?_|http_|fetch_url|web_fetch|browser|webhook|email|smtp|mail_|send_|post_|notify|slack|discord|mcp_|run_agent)/i;

const EXTERNAL_TOOL_EXACT = new Set([
  "postMessage",
  "postChannelMessage",
  "sendDirectMessage",
  "editMessage",
  "deleteMessage",
  "http_request",
  "fetchUrl",
  "web_search",
]);

export function stripHiddenUnicode(text) {
  if (typeof text !== "string") return "";
  return text.replace(HIDDEN_CHARS_RE, "");
}

export function isGuestUserId(userId) {
  return typeof userId === "string" && (userId.startsWith("guest_") || userId.startsWith("anon_"));
}

export function isUntrustedRoomActor(userId, roles) {
  if (isGuestUserId(userId)) return true;
  return isGuestOnlyAuth({ roles });
}

export function classifyMessageTrust(row) {
  if (!row || typeof row !== "object") return "untrusted";
  const source = String(row.source || row.kind || "").toLowerCase();
  if (source.includes("email") || source.includes("inbound") || source.includes("webhook")) {
    return "untrusted";
  }
  if (row.participant_type === "tool" || row.trust === "untrusted") return "untrusted";
  let meta = row.metadata_json;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = null;
    }
  }
  if (meta && typeof meta === "object" && meta.trust === "untrusted") return "untrusted";
  if (isUntrustedRoomActor(row.user_id, meta?.roles || row.roles)) return "untrusted";
  return "trusted";
}

export function isExternalEffectTool(toolName) {
  const name = String(toolName || "").trim();
  if (!name) return false;
  if (EXTERNAL_TOOL_EXACT.has(name)) return true;
  return EXTERNAL_TOOL_RE.test(name);
}

export function evaluateTwoKeyTurn({
  history = [],
  invokerUserId,
  invokerRoles,
  agentId,
  appContext,
  contextFetchUrl,
} = {}) {
  const rows = Array.isArray(history) ? history : [];
  const readUntrusted =
    isUntrustedRoomActor(invokerUserId, invokerRoles) ||
    rows.some((row) => classifyMessageTrust(row) === "untrusted");
  const hasPrivateData =
    Boolean(appContext) ||
    Boolean(String(contextFetchUrl || "").trim()) ||
    rows.some(
      (row) =>
        row.user_id !== agentId && classifyMessageTrust(row) === "trusted",
    );
  return { readUntrusted, hasPrivateData };
}

export function twoKeyRequiresHitl(turn, toolName) {
  if (!turn?.readUntrusted || !turn?.hasPrivateData) return false;
  return isExternalEffectTool(toolName);
}

export function wrapTwoKeyApprovalGate(baseGate, turn) {
  return {
    async needsApproval(toolName, input, context) {
      if (twoKeyRequiresHitl(turn, toolName)) return true;
      if (baseGate?.needsApproval) {
        return baseGate.needsApproval(toolName, input, context);
      }
      return false;
    },
    shouldApprove: baseGate?.shouldApprove,
  };
}

export function parseMarkdownHostAllowlist(env) {
  const raw = String(env?.AGENT_MARKDOWN_HOST_ALLOWLIST || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(hostname, allowlist) {
  const host = String(hostname || "").toLowerCase();
  if (!host || !allowlist.length) return false;
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Drop markdown images/links that are not on the HTTPS host allowlist (classic exfil). */
export function rewriteUntrustedMarkdown(text, allowlist = []) {
  if (typeof text !== "string" || !text) return text;
  const hosts = Array.isArray(allowlist) ? allowlist : [];
  let out = text.replace(/!\[[^\]]*]\(\s*([^)\s]+)\s*\)/g, (_m, url) => {
    try {
      const parsed = new URL(String(url).trim());
      if (parsed.protocol === "https:" && hostAllowed(parsed.hostname, hosts)) return _m;
    } catch {
      /* blocked */
    }
    return "[image omitted]";
  });
  out = out.replace(/\[([^\]]*)]\(\s*([^)\s]+)\s*\)/g, (full, label, url) => {
    try {
      const parsed = new URL(String(url).trim());
      if (parsed.protocol === "https:" && hostAllowed(parsed.hostname, hosts)) return full;
    } catch {
      /* blocked */
    }
    return String(label || "link");
  });
  return out;
}

function parseSharedRoomTwoKeyFlag(value) {
  if (value === false || value === 0 || value === "false" || value === "0") return false;
  if (value === true || value === 1 || value === "true" || value === "1") return true;
  return undefined;
}

/** Env default on. Room `sharedRoomTwoKey` true/false overrides. */
export function twoKeyGuardEnabled(env, roomConfig) {
  const roomFlag = parseSharedRoomTwoKeyFlag(roomConfig?.sharedRoomTwoKey);
  if (roomFlag === false) return false;
  if (roomFlag === true) return true;
  const v = String(env?.SHARED_ROOM_TWO_KEY || "true").trim().toLowerCase();
  return v !== "false" && v !== "0";
}
