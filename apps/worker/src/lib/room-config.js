/**
 * Per-room JSON config (approvalChain and future keys).
 */
import {
  parseApprovalChain,
  DEFAULT_APPROVAL_TIMEOUT_SECONDS,
} from "./room-approval-chain.js";
import { appendRoomTimelineEvent } from "./room-timeline-events.js";

function nowIso() {
  return new Date().toISOString();
}

function parseConfigJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseSharedRoomTwoKey(value) {
  if (value === false || value === 0 || value === "false" || value === "0") return false;
  if (value === true || value === 1 || value === "true" || value === "1") return true;
  return undefined;
}

function parseNlPolicy(value) {
  if (value == null) return undefined;
  const s = String(value).trim().slice(0, 500);
  return s || undefined;
}

/** Stream `enableSlowMode(coolDownInterval)` — seconds between sends, 0 = off. */
export function parseSlowModeSeconds(value) {
  if (value == null || value === false || value === "") return 0;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(3600, n);
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string }} input
 */
export async function getRoomConfig(env, input) {
  const row = await env.DB.prepare(
    `SELECT config_json, updated_at, updated_by FROM room_config WHERE project_id = ? AND room_id = ?`,
  )
    .bind(input.projectId, input.roomId)
    .first();

  const config = parseConfigJson(row?.config_json);
  const chainParsed = parseApprovalChain(config.approvalChain);
  const approvalChain = chainParsed.ok
    ? chainParsed.chain
    : { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS };

  const twoKey = parseSharedRoomTwoKey(config.sharedRoomTwoKey);
  const nlPolicy = parseNlPolicy(config.nlPolicy);
  const slowModeSeconds = parseSlowModeSeconds(config.slowModeSeconds);
  const normalized = { ...config, approvalChain };
  if (twoKey === undefined) delete normalized.sharedRoomTwoKey;
  else normalized.sharedRoomTwoKey = twoKey;
  if (nlPolicy === undefined) delete normalized.nlPolicy;
  else normalized.nlPolicy = nlPolicy;
  normalized.slowModeSeconds = slowModeSeconds == null ? 0 : slowModeSeconds;

  return {
    config: normalized,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, patch: Record<string, unknown>, changedBy: string }} input
 */
export async function patchRoomConfig(env, input) {
  const existing = await getRoomConfig(env, {
    projectId: input.projectId,
    roomId: input.roomId,
  });

  const next = { ...existing.config, ...input.patch };

  if (Object.prototype.hasOwnProperty.call(input.patch, "sharedRoomTwoKey")) {
    const parsed = parseSharedRoomTwoKey(input.patch.sharedRoomTwoKey);
    if (parsed === undefined || input.patch.sharedRoomTwoKey === null) {
      delete next.sharedRoomTwoKey;
    } else {
      next.sharedRoomTwoKey = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input.patch, "nlPolicy")) {
    const parsed = parseNlPolicy(input.patch.nlPolicy);
    if (parsed === undefined || input.patch.nlPolicy === null) {
      delete next.nlPolicy;
    } else {
      next.nlPolicy = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input.patch, "slowModeSeconds")) {
    const parsed = parseSlowModeSeconds(input.patch.slowModeSeconds);
    if (parsed == null) return { ok: false, error: "invalid_slow_mode" };
    next.slowModeSeconds = parsed;
  }

  if (input.patch.approvalChain !== undefined) {
    const parsed = parseApprovalChain(input.patch.approvalChain);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    next.approvalChain = parsed.chain;

    const prevChain = existing.config.approvalChain ?? { steps: [] };
    const chainChanged = JSON.stringify(prevChain) !== JSON.stringify(parsed.chain);
    if (chainChanged) {
      await appendRoomTimelineEvent(env, {
        projectId: input.projectId,
        roomId: input.roomId,
        eventType: "approval_chain_updated",
        createdBy: input.changedBy,
        payload: {
          type: "approval_chain_updated",
          changedBy: input.changedBy,
          previousChain: prevChain,
          newChain: parsed.chain,
          timestamp: nowIso(),
        },
      });
    }
  }

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO room_config (project_id, room_id, config_json, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       config_json = excluded.config_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(input.projectId, input.roomId, JSON.stringify(next), now, input.changedBy)
    .run();

  return {
    ok: true,
    config: next,
    updatedAt: now,
    updatedBy: input.changedBy,
  };
}

/**
 * Load approval chain only (used when creating HITL requests).
 */
export async function assertRoomSlowModeAllowed(env, { projectId, roomId, userId }) {
  const { config } = await getRoomConfig(env, { projectId, roomId });
  const sec = Number(config.slowModeSeconds) || 0;
  if (sec <= 0) return { ok: true, slowModeSeconds: 0 };
  const last = await env.DB.prepare(
    `SELECT created_at FROM messages
     WHERE project_id = ? AND room_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY id DESC LIMIT 1`,
  )
    .bind(projectId, roomId, userId)
    .first();
  if (!last?.created_at) return { ok: true, slowModeSeconds: sec };
  const elapsed = (Date.now() - Date.parse(String(last.created_at))) / 1000;
  if (!Number.isFinite(elapsed) || elapsed >= sec) return { ok: true, slowModeSeconds: sec };
  return {
    ok: false,
    error: "slow_mode",
    slowModeSeconds: sec,
    retryAfterSeconds: Math.max(1, Math.ceil(sec - elapsed)),
  };
}

export async function getRoomApprovalChain(env, projectId, roomId) {
  const { config } = await getRoomConfig(env, { projectId, roomId });
  return config.approvalChain ?? { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS };
}
