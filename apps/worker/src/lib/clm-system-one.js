/**
 * System One sidecar: Jev on Workers AI (`typesafe/jev`) or self-hosted CLM.
 * Does not replace the room LLM (Groq / etc). Fail-closed. Decisions on feeds, not chat.
 */
import { safeOutboundFetch } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";

const CLM_STATE_MAX_CHARS = 8192;
const CLM_TIMEOUT_MS = 8000;
const DEFAULT_HITL_NOUL_MIN = 0.85;
const NEEDS_TOOL_NOUL_MIN = 0.5;
const AGENT_TRACE_FEED = "Agent traces";
export const JEV_MODEL_ID = "typesafe/jev";

function hasWorkersAiRun(env) {
  return Boolean(env?.AI && typeof env.AI.run === "function");
}

export function isClmConfigured(env) {
  return typeof env?.CLM_BASE_URL === "string" && env.CLM_BASE_URL.trim().length > 0;
}

/**
 * @returns {"jev" | "clm" | "off"}
 */
export function resolveSystemOneProvider(env) {
  const raw = String(env?.SYSTEM_ONE_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  if (raw === "clm") return isClmConfigured(env) ? "clm" : "off";
  if (raw === "jev") return hasWorkersAiRun(env) ? "jev" : "off";
  if (hasWorkersAiRun(env)) return "jev";
  if (isClmConfigured(env)) return "clm";
  return "off";
}

export function isSystemOneConfigured(env) {
  return resolveSystemOneProvider(env) !== "off";
}

export function clmSystemOneUrl(env) {
  const base = String(env?.CLM_BASE_URL || "").trim().replace(/\/+$/, "");
  return `${base}/v1/systemone`;
}

export function truncateClmState(text, maxChars = CLM_STATE_MAX_CHARS) {
  const s = String(text || "");
  if (s.length <= maxChars) return s;
  return s.slice(-maxChars);
}

export function clmHitlNoulMin(env) {
  const n = Number(env?.CLM_HITL_NOUL_MIN);
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  return DEFAULT_HITL_NOUL_MIN;
}

export function clmNoulRequiresHuman(noul, min = DEFAULT_HITL_NOUL_MIN) {
  if (typeof noul !== "number" || !Number.isFinite(noul)) return true;
  return noul < min;
}

export function parseClmAnswer(payload, questionId) {
  const answers = payload?.answers;
  if (!answers || typeof answers !== "object") return null;
  const answer = answers[questionId];
  if (!answer || typeof answer !== "object") return null;
  return answer;
}

export function collectOpenAiToolNames(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .map((t) => t?.function?.name || t?.name)
    .filter((n) => typeof n === "string" && n.trim());
}

export function reorderOpenAiTools(tools, preferredName) {
  if (!Array.isArray(tools) || !preferredName) return tools;
  const idx = tools.findIndex((t) => (t?.function?.name || t?.name) === preferredName);
  if (idx <= 0) return tools;
  const copy = [...tools];
  const [picked] = copy.splice(idx, 1);
  return [picked, ...copy];
}

export function filterAgentRowsByHandle(rows, preferredHandle) {
  if (!preferredHandle || !Array.isArray(rows)) return rows;
  const want = String(preferredHandle)
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  const hit = rows.filter(
    (row) =>
      String(row.handle || "")
        .replace(/^@/, "")
        .trim()
        .toLowerCase() === want,
  );
  return hit.length ? hit : rows;
}

export function buildClmRoomState(content, historyRows) {
  const hist = Array.isArray(historyRows) ? historyRows : [];
  const lines = hist.slice(-12).map((row) => {
    const who = row.user_id || "user";
    return `${who}: ${String(row.content || "").slice(0, 400)}`;
  });
  lines.push(`user: ${String(content || "").slice(0, 800)}`);
  return truncateClmState(lines.join("\n"));
}

export function unwrapSystemOnePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.answers && typeof raw.answers === "object") return raw;
  if (raw.result?.answers) return raw.result;
  if (raw.response?.answers) return raw.response;
  if (raw.output?.answers) return raw.output;
  return null;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("timeout");
      err.name = "AbortError";
      reject(err);
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function runJevSystemOne(env, { state, questions, aiRun } = {}) {
  const run = aiRun || (env?.AI && typeof env.AI.run === "function" ? env.AI.run.bind(env.AI) : null);
  if (typeof run !== "function") return { ok: false, reason: "unconfigured" };
  try {
    const raw = await withTimeout(
      run(JEV_MODEL_ID, {
        state: truncateClmState(state),
        questions: questions || {},
      }),
      CLM_TIMEOUT_MS,
    );
    const payload = unwrapSystemOnePayload(raw);
    if (!payload) return { ok: false, reason: "invalid_response" };
    return { ok: true, answers: payload.answers, model: payload.model || "jev" };
  } catch (err) {
    if (err?.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "fetch_failed" };
  }
}

function payloadChoiceMargin(answers) {
  if (!answers || typeof answers !== "object") return 1;
  let worst = 1;
  for (const answer of Object.values(answers)) {
    const vals = Object.values(answer?.probabilities || {})
      .filter((n) => typeof n === "number" && Number.isFinite(n))
      .sort((a, b) => b - a);
    if (vals.length >= 2) worst = Math.min(worst, vals[0] - vals[1]);
  }
  return worst;
}

function cascadeMarginMin(env) {
  const n = Number(env?.ROOM_DECISION_MARGIN_MIN);
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  return 0.15;
}

export async function systemOne(env, opts = {}) {
  const cascade = String(env?.SYSTEM_ONE_CASCADE || "")
    .trim()
    .toLowerCase();
  if (cascade === "clm_then_jev" && isClmConfigured(env) && hasWorkersAiRun(env)) {
    const clm = await clmSystemOne(env, opts);
    if (clm.ok && payloadChoiceMargin(clm.answers) >= cascadeMarginMin(env)) {
      return { ...clm, model: clm.model || "clm" };
    }
    const jev = await runJevSystemOne(env, opts);
    if (jev.ok) {
      return { ...jev, cascadedFrom: clm.ok ? "clm" : clm.reason || "clm" };
    }
    return clm.ok ? { ...clm, model: clm.model || "clm" } : jev;
  }
  const provider = resolveSystemOneProvider(env);
  if (provider === "off") return { ok: false, reason: "unconfigured" };
  if (provider === "jev") return runJevSystemOne(env, opts);
  return clmSystemOne(env, opts);
}

export async function clmSystemOne(env, { state, questions, fetchImpl } = {}) {
  if (!isClmConfigured(env)) return { ok: false, reason: "unconfigured" };
  const url = clmSystemOneUrl(env);
  const fetchFn = fetchImpl || safeOutboundFetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLM_TIMEOUT_MS);
  try {
    const headers = { "content-type": "application/json" };
    const key = String(env.CLM_API_KEY || "").trim();
    if (key) headers.authorization = `Bearer ${key}`;
    const res = await fetchFn(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          state: truncateClmState(state),
          model: "clm-latest",
          questions: questions || {},
          temperature: 1,
        }),
        signal: controller.signal,
      },
      env,
    );
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const json = await res.json();
    if (!json || typeof json !== "object" || !json.answers) {
      return { ok: false, reason: "invalid_response" };
    }
    return { ok: true, answers: json.answers, model: json.model };
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes("ssrf") || msg === "ssrf_blocked") return { ok: false, reason: "ssrf_blocked" };
    if (err?.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function clmChoice(env, { state, questionId, instructions, criteria, fetchImpl, aiRun }) {
  const id = questionId || "choice";
  const result = await systemOne(env, {
    state,
    questions: {
      [id]: { type: "choice", instructions, criteria },
    },
    fetchImpl,
    aiRun,
  });
  if (!result.ok) return { ok: false, reason: result.reason, choice: null };
  const answer = parseClmAnswer(result, id);
  const choice = typeof answer?.choice === "string" ? answer.choice : null;
  if (!choice || !criteria || !Object.prototype.hasOwnProperty.call(criteria, choice)) {
    return { ok: false, reason: "invalid_choice", choice: null, answer };
  }
  return { ok: true, choice, answer, probabilities: answer.probabilities };
}

export async function clmNoul(env, { state, questionId, instructions, fetchImpl, aiRun }) {
  const id = questionId || "noul";
  const result = await systemOne(env, {
    state,
    questions: {
      [id]: { type: "noul", instructions },
    },
    fetchImpl,
    aiRun,
  });
  if (!result.ok) return { ok: false, reason: result.reason, noul: null };
  const answer = parseClmAnswer(result, id);
  const noul = typeof answer?.noul === "number" && Number.isFinite(answer.noul) ? answer.noul : null;
  if (noul == null) return { ok: false, reason: "invalid_noul", noul: null, answer };
  return { ok: true, noul, answer };
}

export function wrapClmApprovalGate(baseGate, env, ctx = {}) {
  return {
    async needsApproval(toolName, input, context) {
      let required = false;
      if (baseGate?.needsApproval) {
        required = await baseGate.needsApproval(toolName, input, context);
      }
      if (required) return true;
      if (!isSystemOneConfigured(env)) return false;
      const state = truncateClmState(
        ctx.stateText || `${toolName} ${JSON.stringify(input || {}).slice(0, 500)}`,
      );
      const noulResult = await clmNoul(env, {
        state,
        questionId: "hitl",
        instructions: `This tool call can run without a human reviewer: ${toolName}`,
        fetchImpl: ctx.fetchImpl,
        aiRun: ctx.aiRun,
      });
      if (!noulResult.ok) return false;
      const extra = clmNoulRequiresHuman(noulResult.noul, clmHitlNoulMin(env));
      let alignHitl = false;
      let alignNoul = null;
      try {
        const { alignmentRequiresHitl, recordRoomDecision, getDecisionsConfig } = await import("./room-decisions.js");
        const toolMode = getDecisionsConfig(env).toolMode;
        if (toolMode === "enforce") {
          const align = await alignmentRequiresHitl(env, {
            state,
            toolName,
            fetchImpl: ctx.fetchImpl,
            aiRun: ctx.aiRun,
          });
          alignNoul = align.noul;
          alignHitl = Boolean(align.extraHitl);
        }
        if (ctx.projectId && ctx.roomId) {
          await recordRoomDecision(env, {
            projectId: ctx.projectId,
            roomId: ctx.roomId,
            kind: "approveTool",
            mode: toolMode,
            toolName,
            runId: ctx.runId,
            agentId: ctx.agentId,
            noul: noulResult.noul,
            model: resolveSystemOneProvider(env),
            choice: extra || alignHitl ? "approve" : "execute",
            twoKey: Boolean(ctx.twoKey),
          });
        }
      } catch {
        /* audit / align must not break HITL */
      }
      if (typeof ctx.onDecision === "function") {
        await Promise.resolve(
          ctx.onDecision({
            kind: "hitl_noul",
            toolName,
            noul: noulResult.noul,
            alignNoul,
            requiresHuman: extra || alignHitl,
          }),
        ).catch(() => {});
      }
      return extra || alignHitl;
    },
    shouldApprove: baseGate?.shouldApprove,
  };
}

export async function logClmFeed(env, { projectId, roomId, userId, body, agentId, status }) {
  try {
    const { listRoomFeeds, createRoomFeed, createFeedMessage } = await import("./room-feeds.js");
    const feeds = await listRoomFeeds(env, { projectId, roomId });
    let feed = (feeds || []).find((f) => f.kind === "agent" && f.name === AGENT_TRACE_FEED);
    if (!feed) {
      const created = await createRoomFeed(env, {
        projectId,
        roomId,
        userId: userId || "workflow",
        name: AGENT_TRACE_FEED,
        kind: "agent",
      });
      if (!created.ok) return;
      feed = created.feed;
    }
    await createFeedMessage(env, {
      projectId,
      roomId,
      feedId: feed.id,
      userId: userId || "workflow",
      body: String(body || "").slice(0, 4000),
      metadata: {
        source: resolveSystemOneProvider(env) === "jev" ? "jev" : "clm",
        agentId: agentId || undefined,
        status: status || "ok",
      },
    });
    logInfo("clm.feed_logged", { projectId, roomId, status: status || "ok" });
  } catch {
    // Feeds must never block chat.
  }
}

export function shouldSystemOneEscalate(noul, env) {
  if (typeof noul !== "number" || !Number.isFinite(noul)) return false;
  const minRaw = Number(env?.SYSTEM_ONE_ESCALATE_NOUL_MIN);
  const min = Number.isFinite(minRaw) && minRaw >= 0 && minRaw <= 1 ? minRaw : DEFAULT_HITL_NOUL_MIN;
  return noul >= min;
}

export async function applySystemOneToolPass(env, { state, tools, fetchImpl, aiRun } = {}) {
  const names = collectOpenAiToolNames(tools);
  if (!isSystemOneConfigured(env) || names.length < 2) {
    return { tools, decision: null };
  }
  const criteria = Object.fromEntries(names.map((n) => [n, n]));
  const result = await systemOne(env, {
    state,
    questions: {
      needs_tool: {
        type: "noul",
        instructions:
          "The assistant should invoke a declared tool for this room state (not reply with text only).",
      },
      tool: {
        type: "choice",
        instructions: "Which declared tool is the best next action? Do not invent names.",
        criteria,
      },
      escalate: {
        type: "noul",
        instructions: "A human should take over this room now (handoff from the AI agent).",
      },
    },
    fetchImpl,
    aiRun,
  });
  if (!result.ok) return { tools, decision: null, reason: result.reason };
  const needs = parseClmAnswer(result, "needs_tool");
  const toolAns = parseClmAnswer(result, "tool");
  const esc = parseClmAnswer(result, "escalate");
  const needsNoul = typeof needs?.noul === "number" && Number.isFinite(needs.noul) ? needs.noul : null;
  const choice = typeof toolAns?.choice === "string" ? toolAns.choice : null;
  const escalate = typeof esc?.noul === "number" && Number.isFinite(esc.noul) ? esc.noul : null;
  let next = tools;
  if (needsNoul != null && needsNoul >= NEEDS_TOOL_NOUL_MIN && choice && Object.prototype.hasOwnProperty.call(criteria, choice)) {
    next = reorderOpenAiTools(tools, choice);
  }
  return {
    tools: next,
    decision: {
      needsTool: needsNoul,
      choice: needsNoul != null && needsNoul >= NEEDS_TOOL_NOUL_MIN ? choice : null,
      escalate,
    },
  };
}
