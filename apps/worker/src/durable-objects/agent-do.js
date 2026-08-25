/**
 * Agent Durable Object (CF-A-014).
 *
 * One instance per (project, agent, user) copilot. Conversation turns and
 * per-session schedules live here so Think-sized 1:1 state never sits on the
 * multi-user Room DO hot path. Room DO stays the chat kernel; this object is
 * optional and only reached via AGENT binding + internal RPC.
 */

import { logError } from "../lib/worker-log.js";
import {
  AGENT_SCHEDULE_ALARM_JOB,
  cancelAgentSchedule,
  claimDueAgentSchedules,
  completeAgentScheduleFire,
  earliestAgentScheduleDueAt,
  fireAgentSchedule,
  serializeSchedule,
  upsertAgentSchedule,
  withAgentScheduleRows,
} from "../lib/agent-schedules.js";
import {
  cancelDoAlarmJob,
  scheduleDoAlarmJob,
  takeDueDoAlarmJobs,
} from "../lib/do-alarm-scheduler.js";
import { backoffMsForFailure, classifyDoFailure, runDoAlarmStep } from "../lib/do-retry-taxonomy.js";
import {
  appendCopilotTurn,
  callRoomDo,
  copilotThreadId,
  loadCopilotState,
  saveCopilotState,
  serializeCopilotState,
} from "../lib/agent-do-session.js";
import { AGENT_RPC_METHODS, parseRpcRequest } from "../lib/do-rpc.js";
import { executeAgentRun } from "../lib/agent-runtime.js";

export class AgentDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.projectId = null;
    this.agentId = null;
    this.userId = null;

    if (typeof state?.blockConcurrencyWhile === "function" && state.storage) {
      this._hydrated = state.blockConcurrencyWhile(async () => {
        const [projectId, agentId, userId] = await Promise.all([
          state.storage.get("projectId"),
          state.storage.get("agentId"),
          state.storage.get("userId"),
        ]);
        if (typeof projectId === "string" && projectId) this.projectId = projectId;
        if (typeof agentId === "string" && agentId) this.agentId = agentId;
        if (typeof userId === "string" && userId) this.userId = userId;
      });
    } else {
      this._hydrated = Promise.resolve();
    }
  }

  async ensureHydrated() {
    await this._hydrated;
  }

  async persistIdentity({ projectId, agentId, userId }) {
    if (projectId) this.projectId = String(projectId);
    if (agentId) this.agentId = String(agentId);
    if (userId) this.userId = String(userId);
    if (!this.state?.storage) return;
    if (this.projectId) await this.state.storage.put("projectId", this.projectId);
    if (this.agentId) await this.state.storage.put("agentId", this.agentId);
    if (this.userId) await this.state.storage.put("userId", this.userId);
  }

  async fetch(request) {
    await this.ensureHydrated();
    const url = new URL(request.url);
    if (url.pathname === "/rpc" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const parsed = parseRpcRequest(body, AGENT_RPC_METHODS);
      if (!parsed.ok) {
        return Response.json(parsed, { status: 400 });
      }
      return this.handleRpc(parsed.method, parsed.params);
    }
    if (url.pathname === "/state" && request.method === "GET") {
      return this.handleRpc("state", {});
    }
    if (url.pathname === "/turn" && request.method === "POST") {
      const params = await request.json().catch(() => ({}));
      return this.handleRpc("turn", params);
    }
    return new Response("Unsupported agent DO request", { status: 400 });
  }

  async handleRpc(method, params) {
    if (method === "ping") {
      return Response.json({ ok: true, method: "ping", agentId: this.agentId });
    }
    if (method === "state") {
      const loaded = await loadCopilotState(this.state.storage);
      return Response.json({ ok: true, ...serializeCopilotState(loaded) });
    }
    if (method === "turn") {
      return this.handleTurn(params);
    }
    if (method === "schedule") {
      return this.handleSchedule(params);
    }
    if (method === "cancel_schedule") {
      return this.handleCancelSchedule(params);
    }
    if (method === "list_schedules") {
      if (!this.state?.storage) return Response.json({ ok: true, schedules: [] });
      const listed = await withAgentScheduleRows(this.state.storage, (rows) => ({
        rows,
        schedules: rows.filter((r) => r.status !== "cancelled").map(serializeSchedule),
      }));
      return Response.json({ ok: true, schedules: listed.schedules || [] });
    }
    if (method === "room_event") {
      return this.handleRoomEvent(params);
    }
    return Response.json({ ok: false, reason: "unknown_method" }, { status: 400 });
  }

  async handleTurn(params) {
    const content = String(params.content || "").trim();
    if (!content) return Response.json({ ok: false, reason: "content_required" }, { status: 400 });
    await this.persistIdentity({
      projectId: params.projectId || this.projectId,
      agentId: params.agentId || this.agentId,
      userId: params.userId || this.userId,
    });
    if (!this.projectId || !this.agentId || !this.userId) {
      return Response.json({ ok: false, reason: "identity_required" }, { status: 400 });
    }
    const threadId = copilotThreadId(this.agentId, this.userId);
    const loaded = await loadCopilotState(this.state.storage);
    const now = Date.now();
    const turns = appendCopilotTurn(loaded.turns, { role: "user", content, at: now }, now);

    const agentRow = await this.env.DB.prepare(
      `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, allowed_tools
       FROM bots WHERE project_id = ? AND id = ?`,
    )
      .bind(this.projectId, this.agentId)
      .first();
    if (!agentRow) {
      await saveCopilotState(this.state.storage, {
        meta: { ...loaded.meta, projectId: this.projectId, agentId: this.agentId, userId: this.userId, threadId, updatedAt: now },
        turns,
      });
      return Response.json({ ok: false, reason: "agent_not_found", ...serializeCopilotState({ meta: loaded.meta, turns }) }, { status: 404 });
    }

    const history = turns
      .slice(-12)
      .map((t) => `${t.role}: ${t.content}`)
      .join("\n");
    const result = await executeAgentRun(this.env, {
      agentRow,
      projectId: this.projectId,
      roomId: threadId,
      userMessage: history,
      userId: this.userId,
      traceId: params.traceId || threadId,
      streamHooks: null,
      skipRoomAnnounce: true,
    });
    if (result.content) {
      appendCopilotTurn(turns, {
        role: "assistant",
        content: result.content,
        runId: result.runId,
        at: Date.now(),
      });
    }
    const meta = {
      ...loaded.meta,
      projectId: this.projectId,
      agentId: this.agentId,
      userId: this.userId,
      threadId,
      lastRunId: result.runId,
      updatedAt: Date.now(),
    };
    await saveCopilotState(this.state.storage, { meta, turns });
    const notifyRoomId = String(params.roomId || "").trim();
    if (notifyRoomId && !notifyRoomId.startsWith("copilot:")) {
      await callRoomDo(this.env, notifyRoomId, "announce", {
        type: "copilot_turn",
        roomId: notifyRoomId,
        agentId: this.agentId,
        userId: this.userId,
        runId: result.runId,
        content: result.content,
        status: result.status,
      });
    }
    return Response.json({
      ok: result.status !== "failed",
      run: {
        runId: result.runId,
        status: result.status,
        content: result.content,
        error: result.error,
        retryCode: result.retryCode,
        retryable: result.retryable,
      },
      ...serializeCopilotState({ meta, turns }),
    });
  }

  async handleSchedule(params) {
    if (!this.state?.storage) {
      return Response.json({ ok: false, reason: "storage_unavailable" }, { status: 503 });
    }
    await this.persistIdentity({
      projectId: params.projectId || this.projectId,
      agentId: params.agentId || this.agentId,
      userId: params.userId || this.userId,
    });
    const result = await withAgentScheduleRows(this.state.storage, (rows) =>
      upsertAgentSchedule(rows, {
        ...params,
        projectId: this.projectId,
        roomId: copilotThreadId(this.agentId, this.userId),
        agentId: this.agentId || params.agentId,
      }),
    );
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: 400 });
    await this.armScheduleAlarm();
    return Response.json({
      ok: true,
      created: result.created,
      schedule: serializeSchedule(result.schedule),
    });
  }

  async handleCancelSchedule(params) {
    const scheduleId = String(params.scheduleId || params.id || "").trim();
    if (!scheduleId) return Response.json({ ok: false, reason: "schedule_id_required" }, { status: 400 });
    const result = await withAgentScheduleRows(this.state.storage, (rows) => cancelAgentSchedule(rows, scheduleId));
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: 404 });
    await this.armScheduleAlarm();
    return Response.json({ ok: true, schedule: serializeSchedule(result.schedule) });
  }

  async handleRoomEvent(params) {
    const summary = String(params.summary || params.content || "").trim();
    if (!summary) return Response.json({ ok: false, reason: "content_required" }, { status: 400 });
    await this.persistIdentity({
      projectId: params.projectId || this.projectId,
      agentId: params.agentId || this.agentId,
      userId: params.userId || this.userId,
    });
    const loaded = await loadCopilotState(this.state.storage);
    const now = Date.now();
    const roomId = String(params.roomId || "").trim();
    const turns = appendCopilotTurn(loaded.turns, {
      role: "user",
      content: roomId ? `[room ${roomId}] ${summary}` : summary,
      at: now,
    }, now);
    const meta = {
      ...loaded.meta,
      projectId: this.projectId,
      agentId: this.agentId,
      userId: this.userId,
      threadId: copilotThreadId(this.agentId, this.userId),
      updatedAt: now,
    };
    await saveCopilotState(this.state.storage, { meta, turns });
    return Response.json({ ok: true, ...serializeCopilotState({ meta, turns }) });
  }

  async armScheduleAlarm() {
    if (!this.state?.storage) return;
    const dueAt = await withAgentScheduleRows(this.state.storage, (rows) => ({
      rows,
      dueAt: earliestAgentScheduleDueAt(rows),
    }));
    const when = dueAt?.dueAt;
    if (when == null) {
      await cancelDoAlarmJob(this.state.storage, AGENT_SCHEDULE_ALARM_JOB);
      return;
    }
    await scheduleDoAlarmJob(this.state.storage, AGENT_SCHEDULE_ALARM_JOB, when, AGENT_SCHEDULE_ALARM_JOB);
  }

  async alarm() {
    const step = await runDoAlarmStep(this.state, async () => {
      await takeDueDoAlarmJobs(this.state.storage);
      await this.processDueSchedules();
    }, { reason: "agent-do-alarm" });
    if (!step.ok && step.retry && this.state?.storage?.setAlarm) {
      await scheduleDoAlarmJob(
        this.state.storage,
        "alarm-retry",
        Date.now() + backoffMsForFailure(step, 0),
        "alarm-retry",
      );
    }
  }

  async processDueSchedules() {
    if (!this.state?.storage) return;
    const claimed = [];
    await withAgentScheduleRows(this.state.storage, (rows) => {
      claimed.push(...claimDueAgentSchedules(rows, Date.now()));
      return { rows };
    });
    for (const schedule of claimed) {
      let fire;
      try {
        fire = await fireAgentSchedule(this.env, schedule, { skipRoomAnnounce: true });
      } catch (err) {
        const classified = classifyDoFailure(err);
        fire = { ok: false, error: classified.message, retry: classified.retry };
        logError("agent_do.schedule_fire_failed", err, { scheduleId: schedule.id });
      }
      await withAgentScheduleRows(this.state.storage, (rows) => {
        const row = rows.find((r) => r.id === schedule.id);
        if (row) {
          completeAgentScheduleFire(row, {
            ok: Boolean(fire?.ok),
            runId: fire?.runId || null,
            error: fire?.error || null,
            retry: fire?.retry !== false,
            delayMs: fire?.delayMs,
          });
        }
        return { rows };
      });
    }
    if (claimed.length) await this.armScheduleAlarm();
  }
}
