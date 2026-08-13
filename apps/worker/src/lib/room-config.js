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

  return {
    config: { ...config, approvalChain },
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
export async function getRoomApprovalChain(env, projectId, roomId) {
  const { config } = await getRoomConfig(env, { projectId, roomId });
  return config.approvalChain ?? { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS };
}
