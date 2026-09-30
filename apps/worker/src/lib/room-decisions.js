/**
 * Room Decisions: fixed-menu System One (Jev/CLM) plus deterministic last word.
 * Does not generate chat text. Author benchmarks are not ours.
 */
import { getFluxyConfig } from "./fluxy-config-runtime.js";
import { isHostedMultiTenantMode } from "./hosted-saas-policy.js";
import {
  clmNoul,
  isSystemOneConfigured,
  resolveSystemOneProvider,
  systemOne,
  truncateClmState,
} from "./clm-system-one.js";
import { logInfo } from "./worker-log.js";
import { scoreMessageNotification } from "./notification-priority.js";

export const FLOOR_MODES = Object.freeze(["keyword", "invoke_only", "calibrated", "silent"]);
export const DECISION_ENFORCE_MODES = Object.freeze(["shadow", "warn", "enforce"]);

export function choiceMargin(probabilities) {
  const vals = Object.values(probabilities || {})
    .filter((n) => typeof n === "number" && Number.isFinite(n))
    .sort((a, b) => b - a);
  if (!vals.length) return null;
  if (vals.length === 1) return vals[0];
  return vals[0] - vals[1];
}

export function decisionMarginMin(env) {
  const n = Number(env?.ROOM_DECISION_MARGIN_MIN);
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  return 0.15;
}

export function resolveDecisionsConfig(env, fileConfig) {
  const file = fileConfig?.decisions && typeof fileConfig.decisions === "object" ? fileConfig.decisions : {};
  const floorRaw = String(env?.ROOM_FLOOR_MODE || file.shouldRespond?.mode || "keyword")
    .trim()
    .toLowerCase();
  const floorMode = FLOOR_MODES.includes(floorRaw) ? floorRaw : "keyword";
  const toolRaw = String(env?.ROOM_TOOL_DECISION_MODE || file.approveTool?.mode || "shadow")
    .trim()
    .toLowerCase();
  const toolMode = DECISION_ENFORCE_MODES.includes(toolRaw) ? toolRaw : "shadow";
  const routeRaw = String(env?.ROOM_ROUTE_MODE || file.routeModel?.mode || "shadow")
    .trim()
    .toLowerCase();
  const routeMode = DECISION_ENFORCE_MODES.includes(routeRaw) ? routeRaw : "shadow";
  const notifyRaw = String(env?.ROOM_NOTIFY_MODE || file.notifyTriage?.mode || "shadow")
    .trim()
    .toLowerCase();
  const notifyMode = DECISION_ENFORCE_MODES.includes(notifyRaw) ? notifyRaw : "shadow";
  const summonRaw = String(env?.ROOM_SUMMON_MODE || file.autoSummon?.mode || "shadow")
    .trim()
    .toLowerCase();
  const summonMode = DECISION_ENFORCE_MODES.includes(summonRaw) ? summonRaw : "shadow";
  const nlRaw = String(env?.ROOM_NL_POLICY_MODE || file.nlPolicy?.mode || "shadow")
    .trim()
    .toLowerCase();
  const nlPolicyMode = DECISION_ENFORCE_MODES.includes(nlRaw) ? nlRaw : "shadow";
  const threshold = Number(file.shouldRespond?.threshold);
  return {
    floorMode,
    toolMode,
    routeMode,
    notifyMode,
    summonMode,
    nlPolicyMode,
    floorThreshold: Number.isFinite(threshold) && threshold >= 0 && threshold <= 1 ? threshold : 0.5,
    labelsOptIn: file.labelsOptIn === true,
  };
}

export function getDecisionsConfig(env) {
  return resolveDecisionsConfig(env, getFluxyConfig());
}

function newId() {
  return crypto.randomUUID();
}

export function shouldRecordDecisionLabels(env, fileConfig) {
  const file = fileConfig?.decisions && typeof fileConfig.decisions === "object" ? fileConfig.decisions : {};
  if (env?.ROOM_DECISIONS_LABELS === "false") return false;
  if (file.labelsOptIn === true) return true;
  if (env?.ROOM_DECISIONS_LABELS === "true" || env?.ROOM_DECISIONS_LABELS === "1") return true;
  if (isHostedMultiTenantMode(env)) return false;
  return true;
}

async function roomHasNoTrainConnection(env, projectId, roomId) {
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS ok FROM entity_room_links l
       INNER JOIN integration_connections c
         ON c.project_id = l.project_id AND c.provider = l.provider
       WHERE l.project_id = ? AND l.room_id = ? AND c.no_train = 1
       LIMIT 1`,
    )
      .bind(projectId, roomId)
      .first();
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function recordRoomDecision(env, row) {
  if (!env?.DB || !row?.projectId || !row?.roomId || !row?.kind) return null;
  if (row.noTrain) return null;
  if (!shouldRecordDecisionLabels(env, getFluxyConfig())) return null;
  if (await roomHasNoTrainConnection(env, row.projectId, row.roomId)) return null;
  const id = row.id || newId();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO room_system_one_decisions (
        id, project_id, room_id, kind, mode, model, model_version, choice, options_json,
        probabilities_json, noul, margin, cascaded_from, two_key, run_id, agent_id, tool_name,
        hitl_request_id, human_outcome, decided_by, decided_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        row.projectId,
        row.roomId,
        String(row.kind).slice(0, 64),
        String(row.mode || "shadow").slice(0, 32),
        row.model ? String(row.model).slice(0, 64) : null,
        row.modelVersion ? String(row.modelVersion).slice(0, 64) : null,
        row.choice ? String(row.choice).slice(0, 128) : null,
        row.options ? JSON.stringify(row.options).slice(0, 4000) : null,
        row.probabilities ? JSON.stringify(row.probabilities).slice(0, 4000) : null,
        typeof row.noul === "number" && Number.isFinite(row.noul) ? row.noul : null,
        typeof row.margin === "number" && Number.isFinite(row.margin) ? row.margin : null,
        row.cascadedFrom ? String(row.cascadedFrom).slice(0, 32) : null,
        row.twoKey ? 1 : 0,
        row.runId || null,
        row.agentId || null,
        row.toolName ? String(row.toolName).slice(0, 128) : null,
        row.hitlRequestId || null,
        row.humanOutcome || null,
        row.decidedBy || null,
        row.decidedAt || null,
        now,
      )
      .run();
    logInfo("room_decision.recorded", { kind: row.kind, roomId: row.roomId, choice: row.choice || null });
    return id;
  } catch {
    return null;
  }
}

export async function linkDecisionToHitl(env, { projectId, roomId, runId, toolName, hitlRequestId }) {
  if (!env?.DB || !hitlRequestId || !projectId || !roomId) return false;
  try {
    const res = await env.DB.prepare(
      `UPDATE room_system_one_decisions SET hitl_request_id = ?
       WHERE id = (
         SELECT id FROM room_system_one_decisions
         WHERE project_id = ? AND room_id = ? AND IFNULL(run_id,'') = IFNULL(?, '')
           AND IFNULL(tool_name,'') = IFNULL(?, '') AND hitl_request_id IS NULL
         ORDER BY created_at DESC LIMIT 1
       )`,
    )
      .bind(hitlRequestId, projectId, roomId, runId || "", toolName || "")
      .run();
    return (res?.meta?.changes || 0) > 0;
  } catch {
    return false;
  }
}

export async function attachHumanOutcome(env, { hitlRequestId, outcome, decidedBy }) {
  if (!env?.DB || !hitlRequestId) return;
  const human =
    outcome === "approved" || outcome === "approve"
      ? "approved"
      : outcome === "skipped" || outcome === "escalated"
        ? "escalated"
        : "denied";
  try {
    await env.DB.prepare(
      `UPDATE room_system_one_decisions
       SET human_outcome = ?, decided_by = ?, decided_at = ?
       WHERE hitl_request_id = ?`,
    )
      .bind(human, decidedBy || null, new Date().toISOString(), hitlRequestId)
      .run();
  } catch {
    /* ignore */
  }
}

export async function listRoomDecisions(env, { projectId, roomId, limit = 50 }) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { results } = await env.DB.prepare(
    `SELECT * FROM room_system_one_decisions
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, roomId, cap)
    .all();
  return (results || []).map((row) => {
    let options = null;
    let probabilities = null;
    try {
      options = row.options_json ? JSON.parse(row.options_json) : null;
    } catch {
      options = null;
    }
    try {
      probabilities = row.probabilities_json ? JSON.parse(row.probabilities_json) : null;
    } catch {
      probabilities = null;
    }
    return {
    id: row.id,
    kind: row.kind,
    mode: row.mode,
    model: row.model || null,
    modelVersion: row.model_version || null,
    choice: row.choice || null,
    options,
    probabilities,
    noul: row.noul ?? null,
    margin: row.margin ?? null,
    cascadedFrom: row.cascaded_from || null,
    twoKey: Number(row.two_key) === 1,
    toolName: row.tool_name || null,
    humanOutcome: row.human_outcome || null,
    decidedBy: row.decided_by || null,
    decidedAt: row.decided_at || null,
    createdAt: row.created_at,
  };
  });
}

function mentionInContent(content) {
  return /(?:^|\s)@[a-zA-Z0-9._-]{1,64}\b/.test(String(content || ""));
}

/**
 * Ambient keyword dispatch is the legacy default (`keyword`).
 * invoke_only / silent / calibrated are opt-in.
 */
export async function applyFloorControl(env, detail) {
  const cfg = getDecisionsConfig(env);
  const content = String(detail?.content || "");
  if (cfg.floorMode === "silent") {
    await recordRoomDecision(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      kind: "shouldRespond",
      mode: cfg.floorMode,
      choice: "silence",
      options: { silence: "no ambient reply" },
      model: "deterministic",
    });
    return { allowAmbient: false, choice: "silence", mode: cfg.floorMode };
  }
  if (cfg.floorMode === "invoke_only") {
    const allow = mentionInContent(content);
    await recordRoomDecision(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      kind: "shouldRespond",
      mode: cfg.floorMode,
      choice: allow ? "speak" : "silence",
      options: { silence: "no unsolicited ambient", speak: "mention present" },
      model: "deterministic",
    });
    return { allowAmbient: allow, choice: allow ? "speak" : "silence", mode: cfg.floorMode };
  }
  if (cfg.floorMode === "calibrated" && isSystemOneConfigured(env)) {
    const criteria = {
      silence: "Do not have an agent speak unsolicited",
      speak: "An ambient or roster agent should post now",
    };
    const result = await systemOne(env, {
      state: truncateClmState(content),
      questions: {
        floor: {
          type: "choice",
          instructions: "Should a room agent speak now, or stay silent? Fixed menu only.",
          criteria,
        },
      },
    });
    const answer = result.ok ? result.answers?.floor : null;
    const choice = answer?.choice === "speak" ? "speak" : "silence";
    const probs = answer?.probabilities;
    const margin = choiceMargin(probs);
    await recordRoomDecision(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      kind: "shouldRespond",
      mode: "enforce",
      choice,
      options: criteria,
      probabilities: probs,
      margin,
      model: result.model || resolveSystemOneProvider(env),
      cascadedFrom: result.cascadedFrom,
    });
    if (!result.ok || choice !== "speak") {
      return { allowAmbient: false, choice: "silence", mode: cfg.floorMode };
    }
    if (margin != null && margin < decisionMarginMin(env)) {
      return { allowAmbient: false, choice: "silence", mode: cfg.floorMode, reason: "low_margin" };
    }
    return { allowAmbient: true, choice: "speak", mode: cfg.floorMode };
  }
  return { allowAmbient: true, choice: "keyword", mode: cfg.floorMode };
}

/** Extra HITL when alignment noul is low. Never abort the run. Deterministic two-key still wins. */
export async function alignmentRequiresHitl(env, { state, toolName, fetchImpl, aiRun }) {
  if (!isSystemOneConfigured(env)) return { extraHitl: false, noul: null };
  const noulResult = await clmNoul(env, {
    state,
    questionId: "align",
    instructions: `This tool call serves the user's stated goal in the room (not a side effect): ${toolName}`,
    fetchImpl,
    aiRun,
  });
  if (!noulResult.ok) return { extraHitl: false, noul: null };
  const minRaw = Number(env?.ROOM_ALIGN_NOUL_MIN);
  const min = Number.isFinite(minRaw) && minRaw >= 0 && minRaw <= 1 ? minRaw : 0.4;
  return { extraHitl: noulResult.noul < min, noul: noulResult.noul };
}

const SKIP_ACK_RE = /^(ok|okay|thanks|thank you|thx|grazie|got it|np|👍|👌)\.?$/i;

export const ROUTE_CHOICES = Object.freeze(["skip", "small", "large"]);

/** Fixed menu. Not a published €/room-hour. */
export function heuristicRouteTurn(userMessage) {
  const t = String(userMessage || "").trim();
  if (!t) return "skip";
  if (SKIP_ACK_RE.test(t)) return "skip";
  if (t.length <= 80 && !/\?/.test(t) && !/@/.test(t)) return "small";
  return "large";
}

export async function routeTurnLlm(env, { projectId, roomId, userMessage, runId, agentId } = {}) {
  const cfg = getDecisionsConfig(env);
  const criteria = {
    skip: "No LLM; canned ack is enough",
    small: "Short cheap model / low max tokens",
    large: "Full room LLM",
  };
  let choice = heuristicRouteTurn(userMessage);
  let probabilities;
  let model = "deterministic";
  let cascadedFrom;
  if (cfg.routeMode === "enforce" && isSystemOneConfigured(env)) {
    const result = await systemOne(env, {
      state: truncateClmState(userMessage),
      questions: {
        route: {
          type: "choice",
          instructions: "How much model capacity does this user turn need? Fixed menu only.",
          criteria,
        },
      },
    });
    const picked = result.ok ? result.answers?.route?.choice : null;
    const margin = choiceMargin(result.ok ? result.answers?.route?.probabilities : null);
    if (picked && ROUTE_CHOICES.includes(picked) && (margin == null || margin >= decisionMarginMin(env))) {
      choice = picked;
      probabilities = result.answers.route.probabilities;
      model = result.model || resolveSystemOneProvider(env);
      cascadedFrom = result.cascadedFrom;
    }
  }
  if (projectId && roomId) {
    await recordRoomDecision(env, {
      projectId,
      roomId,
      kind: "routeModel",
      mode: cfg.routeMode,
      choice,
      options: criteria,
      probabilities,
      model,
      cascadedFrom,
      runId,
      agentId,
    });
  }
  return { choice, apply: cfg.routeMode === "enforce", mode: cfg.routeMode };
}

export function notifyTriageChoice({ isMention, preview, isAnnouncement }) {
  const scored = scoreMessageNotification({
    isMention: Boolean(isMention),
    preview: preview || "",
    topic: isAnnouncement ? "announcement" : isMention ? "mention" : "message",
  });
  if (scored.level === "urgent" || scored.level === "high") return "high";
  if (scored.level === "low") return "low";
  return "normal";
}

export async function recordNotifyTriage(env, detail) {
  const cfg = getDecisionsConfig(env);
  const mentioned = Array.isArray(detail?.mentionedUserIds) ? detail.mentionedUserIds.length > 0 : false;
  const choice = notifyTriageChoice({
    isMention: mentioned,
    preview: detail?.preview || detail?.content,
    isAnnouncement: detail?.roomType === "announcement",
  });
  if (detail?.projectId && detail?.roomId) {
    await recordRoomDecision(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      kind: "notifyTriage",
      mode: cfg.notifyMode,
      choice,
      options: { high: "push now", normal: "default", low: "batch or skip" },
      model: "deterministic",
    });
  }
  return { choice, skipPush: cfg.notifyMode === "enforce" && choice === "low" && !mentioned };
}

const SUMMON_HINT_RE = /\b(invite|bring in|add|summon|call in)\b/i;

export async function maybeSuggestSummon(env, detail) {
  const cfg = getDecisionsConfig(env);
  const content = String(detail?.content || "");
  if (!SUMMON_HINT_RE.test(content) || !detail?.projectId || !detail?.roomId) return null;
  if (!env?.DB) return null;
  let rows = [];
  try {
    const q = await env.DB.prepare(
      `SELECT handle, name FROM bots WHERE project_id = ? AND handle IS NOT NULL LIMIT 12`,
    )
      .bind(detail.projectId)
      .all();
    rows = q.results || [];
  } catch {
    return null;
  }
  const criteria = { silence: "Do not invite anyone" };
  for (const row of rows) {
    const h = String(row.handle || "")
      .replace(/^@/, "")
      .trim()
      .toLowerCase();
    if (h) criteria[h] = `${row.name || h} (@${h})`;
  }
  const keys = Object.keys(criteria);
  if (keys.length < 2) return null;
  let choice = "silence";
  let probabilities;
  let model = "deterministic";
  if (isSystemOneConfigured(env) && (cfg.summonMode === "enforce" || cfg.summonMode === "warn")) {
    const result = await systemOne(env, {
      state: truncateClmState(content),
      questions: {
        summon: {
          type: "choice",
          instructions: "Who should be invited into this room? Fixed roster only. Prefer silence.",
          criteria,
        },
      },
    });
    const picked = result.ok ? result.answers?.summon?.choice : null;
    if (picked && Object.prototype.hasOwnProperty.call(criteria, picked)) {
      choice = picked;
      probabilities = result.answers.summon.probabilities;
      model = result.model || resolveSystemOneProvider(env);
    }
  }
  await recordRoomDecision(env, {
    projectId: detail.projectId,
    roomId: detail.roomId,
    kind: "autoSummon",
    mode: cfg.summonMode,
    choice,
    options: criteria,
    probabilities,
    model,
  });
  return { choice, apply: cfg.summonMode === "enforce" && choice !== "silence" };
}

export const NL_POLICY_REFUSAL = "I can't help with that under this room's policy.";

export function noulToNlChoice(noul) {
  if (typeof noul !== "number" || !Number.isFinite(noul)) return "ok";
  if (noul >= 0.7) return "block";
  if (noul >= 0.45) return "warn";
  return "ok";
}

/**
 * Tenant NL policy. Empty policy = no-op. Without System One we only log skip (cannot score NL).
 * Enforce rewrites agent text on block. Does not delete human messages.
 */
export async function applyNlPolicyToAgentReply(env, { text, policyText, projectId, roomId, agentId, runId } = {}) {
  const policy = String(policyText || "").trim().slice(0, 500);
  const original = typeof text === "string" ? text : "";
  const cfg = getDecisionsConfig(env);
  if (!policy) {
    return { text: original, choice: "ok", mode: cfg.nlPolicyMode };
  }
  let choice = "ok";
  let noul = null;
  let model = "unscored";
  if (isSystemOneConfigured(env)) {
    const noulResult = await clmNoul(env, {
      state: truncateClmState(`Policy:\n${policy}\n\nAssistant:\n${original}`),
      questionId: "nl",
      instructions:
        "This assistant reply violates the operator policy above (medical advice, deals over a stated euro amount, etc.).",
    });
    if (noulResult.ok) {
      noul = noulResult.noul;
      choice = noulToNlChoice(noul);
      model = resolveSystemOneProvider(env);
    }
  }
  if (projectId && roomId) {
    await recordRoomDecision(env, {
      projectId,
      roomId,
      kind: "nlPolicy",
      mode: cfg.nlPolicyMode,
      choice,
      noul,
      options: { ok: "allow", warn: "allow and log", block: "refuse" },
      model,
      agentId,
      runId,
    });
  }
  const rewrite = cfg.nlPolicyMode === "enforce" && choice === "block";
  return {
    text: rewrite ? NL_POLICY_REFUSAL : original,
    choice,
    mode: cfg.nlPolicyMode,
  };
}



