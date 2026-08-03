/**
 * Multi-Agent Debate UX (#45) — visible multi-perspective agent thread + moderator synthesis.
 */

import { chatCompletion, isAiConfigured } from "./ai-chat-completion.js";

const MAX_ROLES_PER_SESSION = 3;
const DEFAULT_MAX_ROUNDS = 2;
const DEBATE_TIMEOUT_MS = 45000;

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export const DEFAULT_DEBATE_ROLES = [
  {
    roleName: "Technical",
    systemPrompt:
      "You are the technical expert in a multi-agent debate. Give a concise technical perspective (2–4 sentences). Focus on feasibility, architecture, and implementation trade-offs.",
    sortOrder: 0,
  },
  {
    roleName: "Business",
    systemPrompt:
      "You are the business strategist in a multi-agent debate. Give a concise business perspective (2–4 sentences). Focus on ROI, stakeholders, and go-to-market impact.",
    sortOrder: 1,
  },
  {
    roleName: "Risk",
    systemPrompt:
      "You are the risk analyst in a multi-agent debate. Give a concise risk perspective (2–4 sentences). Focus on compliance, security, and failure modes.",
    sortOrder: 2,
  },
];

/**
 * @param {*} row
 */
export function mapDebateRoleRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    triggerPattern: row.trigger_pattern ? String(row.trigger_pattern) : null,
    roleName: String(row.role_name),
    systemPrompt: String(row.system_prompt),
    maxRounds: Number(row.max_rounds) || DEFAULT_MAX_ROUNDS,
    sortOrder: Number(row.sort_order) || 0,
    enabled: Number(row.enabled) !== 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * @param {*} row
 */
export function mapDebateSessionRow(row) {
  if (!row) return null;
  let steps = [];
  try {
    const parsed = JSON.parse(String(row.steps_json || "[]"));
    steps = Array.isArray(parsed) ? parsed : [];
  } catch {
    steps = [];
  }
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    roomId: String(row.room_id),
    prompt: String(row.prompt),
    status: String(row.status),
    maxRounds: Number(row.max_rounds) || DEFAULT_MAX_ROUNDS,
    currentRound: Number(row.current_round) || 0,
    steps,
    synthesisContent: row.synthesis_content ? String(row.synthesis_content) : null,
    latencyMs: row.latency_ms != null ? Number(row.latency_ms) : null,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

/**
 * Build LLM context from prior debate steps in the same session.
 * @param {Array<{ roleName: string, content: string, round: number }>} priorSteps
 * @param {string} userPrompt
 */
export function buildDebateMessages(priorSteps, userPrompt) {
  const messages = [{ role: "user", content: userPrompt }];
  for (const step of priorSteps) {
    messages.push({
      role: "assistant",
      content: `[${step.roleName}, round ${step.round}]: ${step.content}`,
    });
  }
  return messages;
}

export async function listDebateRoles(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM debate_roles WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapDebateRoleRow);
}

export async function createDebateRole(env, input) {
  const roleName = String(input.roleName ?? "").trim();
  const systemPrompt = String(input.systemPrompt ?? "").trim();
  if (!roleName || roleName.length > 64) {
    return { ok: false, reason: "role_name_required" };
  }
  if (!systemPrompt || systemPrompt.length > 4000) {
    return { ok: false, reason: "system_prompt_required" };
  }
  const now = new Date().toISOString();
  const id = generateId("drole");
  await env.DB.prepare(
    `INSERT INTO debate_roles
     (id, project_id, trigger_pattern, role_name, system_prompt, max_rounds, sort_order, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.triggerPattern?.trim() || null,
      roleName,
      systemPrompt,
      Math.min(5, Math.max(1, Number(input.maxRounds) || DEFAULT_MAX_ROUNDS)),
      Number(input.sortOrder) || 0,
      now,
      now,
    )
    .run();
  const role = mapDebateRoleRow(
    await env.DB.prepare(`SELECT * FROM debate_roles WHERE id = ?`).bind(id).first(),
  );
  return { ok: true, role };
}

export async function deleteDebateRole(env, { projectId, roleId }) {
  await env.DB.prepare(`DELETE FROM debate_roles WHERE id = ? AND project_id = ?`)
    .bind(roleId, projectId)
    .run();
  return { ok: true };
}

export async function seedDefaultDebateRoles(env, { projectId }) {
  const existing = await listDebateRoles(env, { projectId });
  if (existing.length > 0) return { ok: true, seeded: 0, roles: existing };
  const now = new Date().toISOString();
  for (const preset of DEFAULT_DEBATE_ROLES) {
    const id = generateId("drole");
    await env.DB.prepare(
      `INSERT INTO debate_roles
       (id, project_id, trigger_pattern, role_name, system_prompt, max_rounds, sort_order, enabled, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id,
        projectId,
        preset.roleName,
        preset.systemPrompt,
        DEFAULT_MAX_ROUNDS,
        preset.sortOrder,
        now,
        now,
      )
      .run();
  }
  const roles = await listDebateRoles(env, { projectId });
  return { ok: true, seeded: roles.length, roles };
}

export async function listDebateSessions(env, { projectId, roomId, limit = 20 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM debate_sessions
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, roomId, Math.min(100, Math.max(1, Number(limit) || 20)))
    .all();
  return (rows.results || []).map(mapDebateSessionRow);
}

async function announceRoomPayload(env, roomId, payload) {
  try {
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({ roomId, ...payload }),
    });
  } catch {
    /* ignore broadcast failures */
  }
}

/**
 * @param {*} env
 * @param {string} roomId
 * @param {string} sessionId
 * @param {Record<string, unknown>} step
 */
async function announceAgentStep(env, roomId, sessionId, step) {
  await announceRoomPayload(env, roomId, {
    type: "agent_step",
    sessionId,
    step,
  });
}

async function postRoomMessage(env, { projectId, roomId, userId, content, parentId = null }) {
  const createdAt = new Date().toISOString();
  const insert = await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
  )
    .bind(projectId, roomId, userId, content, createdAt, parentId)
    .run();
  const messageId = insert.meta.last_row_id;
  await announceRoomPayload(env, roomId, {
    id: messageId,
    content,
    userId,
    senderId: userId,
    parentId,
    createdAt,
  });
  return messageId;
}

/**
 * Run a multi-agent debate session: each role speaks, then moderator synthesizes.
 * @param {*} env
 * @param {{ projectId: string, roomId: string, prompt: string, roleIds?: string[], maxRounds?: number }} input
 */
export async function runDebateSession(env, input) {
  const prompt = String(input.prompt ?? "").trim();
  if (!prompt || prompt.length > 4000) {
    return { ok: false, reason: "prompt_required" };
  }
  if (!isAiConfigured(env)) {
    return { ok: false, reason: "ai_not_configured" };
  }

  const maxRounds = Math.min(3, Math.max(1, Number(input.maxRounds) || 1));
  const start = performance.now();
  const sessionId = generateId("debate");
  const now = new Date().toISOString();

  let roles = await listDebateRoles(env, { projectId: input.projectId });
  roles = roles.filter((r) => r.enabled);
  if (Array.isArray(input.roleIds) && input.roleIds.length) {
    const allowed = new Set(input.roleIds.map(String));
    roles = roles.filter((r) => allowed.has(r.id));
  }
  if (roles.length === 0) {
    await seedDefaultDebateRoles(env, { projectId: input.projectId });
    roles = (await listDebateRoles(env, { projectId: input.projectId })).filter((r) => r.enabled);
  }
  roles = roles.slice(0, MAX_ROLES_PER_SESSION);

  await env.DB.prepare(
    `INSERT INTO debate_sessions
     (id, project_id, room_id, prompt, status, max_rounds, current_round, steps_json, created_at)
     VALUES (?, ?, ?, ?, 'running', ?, 0, '[]', ?)`,
  )
    .bind(sessionId, input.projectId, input.roomId, prompt, maxRounds, now)
    .run();

  /** @type {Array<Record<string, unknown>>} */
  const steps = [];

  try {
    for (let round = 1; round <= maxRounds; round += 1) {
      for (const role of roles) {
        const stepId = generateId("dstep");
        const agentId = `debate-${role.roleName.toLowerCase().replace(/\s+/g, "-")}`;

        const runningStep = {
          id: stepId,
          sessionId,
          agentId,
          roleName: role.roleName,
          participantRole: "debate",
          round,
          content: "",
          status: "running",
        };
        await announceAgentStep(env, input.roomId, sessionId, runningStep);

        const priorForRole = steps.filter((s) => s.participantRole === "debate");
        const llm = await chatCompletion(env, {
          messages: [
            { role: "system", content: role.systemPrompt },
            ...buildDebateMessages(priorForRole, prompt),
          ],
          maxTokens: 320,
          temperature: 0.5,
          logContext: { projectId: input.projectId, feature: "agent_debate", role: role.roleName },
        });

        if (!llm.ok) {
          const failedStep = { ...runningStep, status: "failed", content: llm.error };
          steps.push(failedStep);
          await announceAgentStep(env, input.roomId, sessionId, failedStep);
          continue;
        }

        const completedStep = {
          ...runningStep,
          status: "completed",
          content: llm.content,
        };
        steps.push(completedStep);
        await announceAgentStep(env, input.roomId, sessionId, completedStep);
      }

      await env.DB.prepare(
        `UPDATE debate_sessions SET current_round = ?, steps_json = ? WHERE id = ?`,
      )
        .bind(round, JSON.stringify(steps), sessionId)
        .run();
    }

    const perspectives = steps
      .filter((s) => s.status === "completed" && s.participantRole === "debate")
      .map((s) => `[${s.roleName}]: ${s.content}`)
      .join("\n\n");

    const modStepId = generateId("dstep");
    const modRunning = {
      id: modStepId,
      sessionId,
      agentId: "debate-moderator",
      roleName: "Moderator",
      participantRole: "moderator",
      round: maxRounds,
      content: "",
      status: "running",
    };
    await announceAgentStep(env, input.roomId, sessionId, modRunning);

    const synthesis = await chatCompletion(env, {
      messages: [
        { role: "user", content: prompt },
        {
          role: "assistant",
          content: `Perspectives from the debate:\n\n${perspectives}`,
        },
        {
          role: "user",
          content:
            "Synthesize a single balanced answer for the room. Acknowledge trade-offs briefly. 3–6 sentences.",
        },
      ],
      maxTokens: 512,
      temperature: 0.4,
      logContext: { projectId: input.projectId, feature: "agent_debate_moderator" },
    });

    let synthesisContent = synthesis.ok
      ? synthesis.content
      : "Debate completed but synthesis failed — review individual perspectives above.";

    const modCompleted = {
      ...modRunning,
      status: synthesis.ok ? "completed" : "failed",
      content: synthesisContent,
    };
    steps.push(modCompleted);
    await announceAgentStep(env, input.roomId, sessionId, modCompleted);

    const latencyMs = Math.round(performance.now() - start);
    const completedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE debate_sessions
       SET status = ?, steps_json = ?, synthesis_content = ?, latency_ms = ?, completed_at = ?
       WHERE id = ?`,
    )
      .bind(
        synthesis.ok ? "completed" : "partial",
        JSON.stringify(steps),
        synthesisContent,
        latencyMs,
        completedAt,
        sessionId,
      )
      .run();

    if (synthesis.ok && synthesisContent) {
      await postRoomMessage(env, {
        projectId: input.projectId,
        roomId: input.roomId,
        userId: "debate-moderator",
        content: synthesisContent,
      });
    }

    return {
      ok: true,
      session: mapDebateSessionRow(
        await env.DB.prepare(`SELECT * FROM debate_sessions WHERE id = ?`).bind(sessionId).first(),
      ),
      timedOut: latencyMs > DEBATE_TIMEOUT_MS,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    await env.DB.prepare(
      `UPDATE debate_sessions SET status = 'failed', steps_json = ?, latency_ms = ?, completed_at = ? WHERE id = ?`,
    )
      .bind(JSON.stringify(steps), latencyMs, new Date().toISOString(), sessionId)
      .run();
    return {
      ok: false,
      reason: "debate_failed",
      error: err instanceof Error ? err.message : String(err),
      sessionId,
    };
  }
}
