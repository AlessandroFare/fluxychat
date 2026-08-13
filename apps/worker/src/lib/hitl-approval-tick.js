/**
 * HITL approval chain step escalation on timeout (cron tick).
 * Advances to the next approver or fires fallback (notify_channel).
 */
import {
  resolveApproverAtStep,
  stepTimeoutSeconds,
  DEFAULT_APPROVAL_TIMEOUT_SECONDS,
} from "./room-approval-chain.js";
import { fanoutRoomInternal } from "./room-shard.js";
import { appendRoomTimelineEvent } from "./room-timeline-events.js";
import { logInfo } from "./worker-log.js";

function nowIso() {
  return new Date().toISOString();
}

function parseChain(row) {
  try {
    return JSON.parse(String(row.approval_chain_snapshot_json || "{}"));
  } catch {
    return { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS };
  }
}

function computeStepExpiry(chain, stepIndex) {
  const steps = chain?.steps ?? [];
  const step = steps[stepIndex];
  const defaultTimeout = chain?.defaultTimeoutSeconds ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS;
  const seconds = step ? stepTimeoutSeconds(step, defaultTimeout) : defaultTimeout;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Process one pending approval whose step has expired.
 * @param {*} env
 * @param {*} row
 */
export async function processHitlApprovalExpiry(env, row) {
  const now = nowIso();
  const chain = parseChain(row);
  const steps = chain.steps ?? [];
  const currentIndex = row.current_step_index ?? 0;
  const nextIndex = currentIndex + 1;

  if (nextIndex >= steps.length) {
    await env.DB.prepare(
      `UPDATE hitl_approval_requests
       SET status = 'expired', decided_at = ?, expires_at = NULL
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(now, row.id)
      .run();

    await appendRoomTimelineEvent(env, {
      projectId: row.project_id,
      roomId: row.room_id,
      eventType: "approval_expired",
      payload: { approvalRequestId: row.id, reason: "chain_exhausted" },
    });

    return { action: "expired", id: row.id };
  }

  const resolved = resolveApproverAtStep(steps, nextIndex);

  if (resolved.isFallback && resolved.fallback === "notify_channel") {
    await fanoutRoomInternal(env, row.project_id, row.room_id, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "server_event",
        roomId: row.room_id,
        name: "hitl.approval_escalated",
        userId: "system",
        data: {
          approvalRequestId: row.id,
          toolName: row.tool_name,
          stepIndex: nextIndex,
          fallback: "notify_channel",
        },
        at: now,
      }),
    });

    await env.DB.prepare(
      `UPDATE hitl_approval_requests
       SET current_step_index = ?, current_approver_id = NULL, expires_at = NULL
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(nextIndex, row.id)
      .run();

    await appendRoomTimelineEvent(env, {
      projectId: row.project_id,
      roomId: row.room_id,
      eventType: "approval_escalated",
      payload: {
        approvalRequestId: row.id,
        stepIndex: nextIndex,
        fallback: "notify_channel",
      },
    });

    logInfo("hitl_approval.notify_channel", {
      id: row.id,
      projectId: row.project_id,
      roomId: row.room_id,
    });

    return { action: "notify_channel", id: row.id, stepIndex: nextIndex };
  }

  const expiresAt = computeStepExpiry(chain, nextIndex);
  await env.DB.prepare(
    `UPDATE hitl_approval_requests
     SET current_step_index = ?, current_approver_id = ?, expires_at = ?
     WHERE id = ? AND status = 'pending'`,
  )
    .bind(nextIndex, resolved.approverId, expiresAt, row.id)
    .run();

  await appendRoomTimelineEvent(env, {
    projectId: row.project_id,
    roomId: row.room_id,
    eventType: "approval_escalated",
    payload: {
      approvalRequestId: row.id,
      stepIndex: nextIndex,
      currentApproverId: resolved.approverId,
      expiresAt,
    },
  });

  logInfo("hitl_approval.escalated", {
    id: row.id,
    stepIndex: nextIndex,
    approverId: resolved.approverId,
  });

  return {
    action: "escalated",
    id: row.id,
    stepIndex: nextIndex,
    approverId: resolved.approverId,
  };
}

/**
 * Cron tick: escalate pending approvals past expires_at.
 * @param {*} env
 * @param {{ projectId?: string, limit?: number }} [opts]
 */
export async function tickHitlApprovalEscalations(env, opts = {}) {
  if (!env?.DB) return { processed: 0, results: [] };

  const now = nowIso();
  let sql = `SELECT * FROM hitl_approval_requests
             WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?`;
  const binds = [now];
  if (opts.projectId) {
    sql += ` AND project_id = ?`;
    binds.push(opts.projectId);
  }
  sql += ` ORDER BY expires_at ASC LIMIT ?`;
  binds.push(Math.min(100, Math.max(1, Number(opts.limit) || 50)));

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const out = [];
  for (const row of results || []) {
    out.push(await processHitlApprovalExpiry(env, row));
  }
  return { processed: out.length, results: out };
}
