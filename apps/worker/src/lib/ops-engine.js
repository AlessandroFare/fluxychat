import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { findStep, normalizeOpsDefinition } from "./ops-definition.js";
import { evalJsonLogic } from "./ops-jsonlogic.js";
import { bindApprovalPayload, createOpsToolGateway, decideOpsApproval } from "./ops-gateway.js";
import { normalizeOpsPolicy } from "./ops-policy.js";
import { evaluateAdaptiveGate } from "./ops-adaptive-gates.js";
import { scheduleDoAlarmJob } from "./do-alarm-scheduler.js";
import { appendRoomTimelineEvent } from "./room-timeline-events.js";
import { issueOpsGuestInvite } from "./ops-guest.js";

function neighbors(step) {
  if (!step?.next) return [];
  if (typeof step.next === "string") return [{ to: step.next }];
  return Array.isArray(step.next) ? step.next : [];
}

function pickNext(step, context) {
  const branches = neighbors(step);
  if (!branches.length) return "end";
  let fallback = branches.find((branch) => branch.when === "else" || branch.when == null);
  for (const branch of branches) {
    if (branch.when && branch.when !== "else") {
      try {
        if (evalJsonLogic(branch.when, context)) return branch.to;
      } catch {
        return "end";
      }
    }
  }
  return fallback?.to || "end";
}

function contextForTool(step, context) {
  if (context?.pendingWrite && context.pendingWrite.tool === step.tool) return context.pendingWrite.input;
  const {
    approvalId,
    payloadHash,
    pendingWrite,
    pendingTool,
    pendingInput,
    injectionIgnored,
    lastToolResult,
    escalatedTasks,
    gate,
    ...rest
  } = context || {};
  // OPS-04: explicit step input wins over run context (trigger body / tool
  // results must not shadow authored tool arguments).
  return { ...rest, ...(step.input || {}) };
}

function nextToolCall(definition, fromStep, context) {
  let id = pickNext(fromStep, context);
  for (let i = 0; i < 20 && id && id !== "end"; i++) {
    const step = findStep(definition, id);
    if (!step) return null;
    if (step.type === "tool_call") return step;
    id = pickNext(step, context);
  }
  return null;
}

function quorumFor(step, policy, context) {
  const base = Number(step.quorum?.default) || 1;
  if (policy?.amountQuorum?.if) {
    try {
      if (evalJsonLogic(policy.amountQuorum.if, context)) return Number(policy.amountQuorum.require) || base;
    } catch {
      /* keep base */
    }
  }
  const extra = Array.isArray(step.quorum?.when) ? step.quorum.when : [];
  for (const rule of extra) {
    if (rule?.if && evalJsonLogic(rule.if, context)) return Number(rule.require) || base;
  }
  return base;
}

async function emit(env, store, run, eventType, payload, actor) {
  await store.appendEvent({
    projectId: run.projectId,
    runId: run.id,
    actor: actor || "system",
    eventType,
    inputHash: await canonicalPayloadHash(payload || {}),
    result: payload || {},
  });
  if (env?.DB && run.roomId) {
    await appendRoomTimelineEvent(env, {
      projectId: run.projectId,
      roomId: run.roomId,
      eventType,
      payload: payload || {},
      createdBy: actor || null,
    }).catch(() => {});
  }
}

async function setStep(store, run, stepId, patch) {
  return store.upsertStep({
    projectId: run.projectId,
    runId: run.id,
    stepId,
    status: "pending",
    attempts: 0,
    ...patch,
  });
}

/**
 * I2: a statically allowed call can still stop for one approval when the
 * behavior around it is unusual (first use, off-hours, spike). Returns true
 * when the run was parked on the gate.
 */
async function requestAdaptiveGate({ env, store, run, step, input, policy, gateway, actor, stamp }) {
  const gates = policy?.adaptiveGates;
  if (!gates?.enabled) return false;
  // Already gated this step: the decision decides; re-gating would loop.
  if (run.context?.gate?.stepId === step.id) return false;
  const tool = (gateway.tools || []).find((item) => item.name === step.tool);
  // Tools that already need approval carry their own human gate; stacking a
  // second one on the same call would only train approvers to rubber-stamp.
  if (!tool || tool.requiresApproval) return false;
  const reasons = await evaluateAdaptiveGate(store, { projectId: run.projectId, tool: step.tool, gates });
  if (!reasons.length) return false;

  const approval = await bindApprovalPayload(store, {
    projectId: run.projectId,
    runId: run.id,
    stepId: step.id,
    tool: step.tool,
    input,
    required: 1,
  });
  const dueAt = new Date(stamp + (step.timeout?.afterMs || 86_400_000)).toISOString();
  await store.createTask({
    projectId: run.projectId,
    runId: run.id,
    stepId: step.id,
    role: (gates.approveRoles || ["owner"])[0],
    dueAt,
    status: "open",
  });
  run.status = "waiting";
  run.context = {
    ...run.context,
    gate: { stepId: step.id, approvalId: approval.id, reasons, at: new Date(stamp).toISOString() },
  };
  await setStep(store, run, step.id, { status: "waiting", result: { ok: false, error: "adaptive_gate", reasons } });
  await store.saveRun(run);
  if (env?.OPS_ROOM_STORAGE) {
    await scheduleDoAlarmJob(env.OPS_ROOM_STORAGE, `ops:${run.id}:${step.id}`, new Date(dueAt).getTime(), "ops-timeout");
  }
  await emit(env, store, run, "ops.gate.requested", {
    stepId: step.id,
    tool: step.tool,
    approvalId: approval.id,
    reasons,
    required: 1,
  }, actor);
  return true;
}

/**
 * Generic interpreter. No per-process branches.
 */
export async function startOpsRun(store, {
  env,
  projectId,
  version,
  trigger,
  context,
  actor,
  actorRoles,
  roomId,
  simulate,
  executeTool,
}) {
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));
  const definition = normalizeOpsDefinition(version.definition);
  const startStep = definition.steps[0];
  const run = await store.createRun({
    projectId,
    versionId: version.id,
    roomId,
    status: "running",
    trigger: {
      ...(trigger || { type: "manual" }),
      // C7: tool ACLs evaluate the run's initiator, so the identity travels
      // with the trigger (persisted with the run, covered by the evidence).
      actor: actor || null,
      roles: Array.isArray(actorRoles) ? actorRoles.map(String).slice(0, 20) : [],
    },
    context: context || {},
    currentStepId: startStep.id,
    killSwitch: false,
    // maxToolCalls travels with the run so the console can show the budget
    // without a second query; the ops_budgets row stays the enforcement.
    cost: { toolCalls: 0, tokens: 0, maxToolCalls: policy.budgets.maxToolCallsPerRun },
  });
  await store.saveBudget({
    projectId,
    runId: run.id,
    maxToolCalls: policy.budgets.maxToolCallsPerRun,
    maxTokens: policy.budgets.maxTokensPerRun,
    toolCalls: 0,
    tokens: 0,
  });
  await emit(env, store, run, "ops.run.started", { trigger: run.trigger }, actor);
  await advanceOpsRun(store, { env, run, definition, policy, actor, simulate, executeTool });
  return run;
}

export async function advanceOpsRun(store, { env, run, definition: rawDefinition, policy, actor, now, simulate, executeTool }) {
  // Always normalize: stored definitions may be raw (draft PATCH saves the
  // request body verbatim), so `step.timeout.afterMs` and friends are not
  // guaranteed otherwise. Normalization is idempotent.
  const definition = normalizeOpsDefinition(rawDefinition);
  // C6/I6: computed once per advance, not per tool call.
  const confidentialTools = new Set(normalizeOpsPolicy(policy).confidentialTools);
  if (run.killSwitch) {
    run.status = "cancelled";
    await store.saveRun(run);
    return run;
  }
  const stamp = now || Date.now();
  let guard = 0;
  while (run.status === "running" && guard < 50) {
    guard += 1;
    const step = findStep(definition, run.currentStepId);
    if (!step || step.type === "end") {
      run.status = "done";
      run.currentStepId = "end";
      await emit(env, store, run, "ops.run.finished", { status: "done" }, actor);
      await store.saveRun(run);
      return run;
    }
    await setStep(store, run, step.id, { status: "running", startedAt: new Date(stamp).toISOString() });
    await emit(env, store, run, "ops.step.started", { stepId: step.id, type: step.type }, actor);

    if (step.type === "agent_task") {
      const gateway = await createOpsToolGateway({
        store,
        projectId: run.projectId,
        run,
        definition,
        policy,
        execute: executeTool,
      });
      const instruction = String(step.instruction || "");
      const untrusted = String(run.context?.untrustedText || run.context?.documentText || "");
      if (/publish|grant tools|ignore policy/i.test(untrusted) && !/publish|grant tools/i.test(instruction)) {
        run.context = { ...run.context, injectionIgnored: true };
      }
      const calls = [];
      for (const toolName of step.tools || []) {
        const result = await gateway.call(toolName, run.context?.toolInputs?.[toolName] || {}, { actor, simulate });
        calls.push({ toolName, result });
        if (result?.interruptReason === "budget-exceeded") {
          await setStep(store, run, step.id, { status: "interrupted", interruptReason: "budget-exceeded" });
          run.status = "failed";
          await store.saveRun(run);
          return run;
        }
        if (!result?.ok && result?.error === "input_required") {
          // shortcut: MRTR suspension is supported on tool_call steps only; an
          // agent_task loop fails loudly instead of skipping the tool silently.
          await setStep(store, run, step.id, { status: "failed", error: "input_required" });
          run.status = "failed";
          await store.saveRun(run);
          return run;
        }
        if (result?.ok && result?.data) {
          run.context = { ...run.context, ...(result.data || {}) };
        }
        if (toolName === "files.search") {
          const citations = result?.citations || result?.data?.citations || [];
          run.context = { ...run.context, lastCitations: citations };
          if (step.cite !== false && Array.isArray(result?.chunks) && result.chunks.length && !citations.length) {
            await setStep(store, run, step.id, { status: "failed", error: "citations_required" });
            run.status = "failed";
            await store.saveRun(run);
            return run;
          }
        }
      }
      await setStep(store, run, step.id, { status: "done", result: { calls }, endedAt: new Date().toISOString() });
      run.currentStepId = pickNext(step, run.context);
      continue;
    }

    if (step.type === "tool_call") {
      const gateway = await createOpsToolGateway({
        store,
        projectId: run.projectId,
        run,
        definition,
        policy,
        execute: executeTool,
      });
      const pendingInput = run.context?.pendingInput;
      const resumed = Boolean(
        pendingInput && pendingInput.stepId === step.id && Array.isArray(pendingInput.answers),
      );
      const input = { ...contextForTool(step, run.context) };
      if (resumed) {
        // MRTR retry: the same call continues with the user's answers.
        input.inputResponses = pendingInput.answers;
        if (pendingInput.requestState) input.requestState = pendingInput.requestState;
      }
      if (!simulate) {
        const gated = await requestAdaptiveGate({ env, store, run, step, input, policy, gateway, actor, stamp });
        if (gated) return run;
      }
      const result = await gateway.call(step.tool, input, { actor, simulate, resumed });
      if (!result.ok && result.error === "input_required") {
        if (!Array.isArray(result.requests) || !result.requests.length) {
          // No usable request to show: asking the room is not possible.
          await setStep(store, run, step.id, { status: "failed", error: "input_required" });
          run.status = "failed";
          await store.saveRun(run);
          return run;
        }
        const request = result.requests[0];
        const message = String(request?.params?.message || result.message || "Input required").slice(0, 500);
        run.status = "waiting";
        run.context = {
          ...run.context,
          pendingInput: {
            stepId: step.id,
            tool: step.tool,
            server: input?.server || null,
            requestState: result.requestState || null,
            requests: result.requests,
            askedAt: new Date().toISOString(),
          },
        };
        await setStep(store, run, step.id, { status: "waiting", result: { ok: false, error: "input_required" } });
        await store.saveRun(run);
        // The room card is a timeline event; the ops-level tool log record is
        // written by the gateway itself.
        if (env?.DB && run.roomId) {
          await appendRoomTimelineEvent(env, {
            projectId: run.projectId,
            roomId: run.roomId,
            eventType: "ops.tool.input_required",
            payload: {
              stepId: step.id,
              tool: step.tool,
              server: input?.server || null,
              message,
              requestId: request?.id || null,
            },
            createdBy: actor || null,
          }).catch(() => {});
        }
        return run;
      }
      if (!result.ok && result.error === "approval_required") {
        if (resumed) {
          // The grant was consumed on the first attempt and cannot be revived;
          // fail loudly rather than leave a run waiting with no way to resume.
          await setStep(store, run, step.id, { status: "failed", error: "approval_required" });
          run.status = "failed";
          await store.saveRun(run);
          return run;
        }
        run.status = "waiting";
        await setStep(store, run, step.id, { status: "waiting", result });
        await store.saveRun(run);
        return run;
      }
      if (!result.ok) {
        run.status = "failed";
        await setStep(store, run, step.id, { status: "failed", error: result.error });
        await store.saveRun(run);
        if (result.error === "tool_changed") {
          // Drift block is a room-visible card too: the room must know the call
          // was stopped because the tool definition changed under its feet.
          await emit(env, store, run, "ops.mcp.tool_blocked", {
            stepId: step.id,
            tool: step.tool,
            server: result.server || input?.server || null,
            message: String(result.message || "This tool's definition changed since it was approved.").slice(0, 500),
          }, actor);
        }
        return run;
      }
      if (resumed) {
        run.context = { ...run.context };
        delete run.context.pendingInput;
      }
      if (run.context?.gate?.stepId === step.id) {
        // The gate granted this call: clear it, so a later visit re-evaluates.
        run.context = { ...run.context };
        delete run.context.gate;
      }
      run.context = { ...run.context, lastToolResult: result };
      // C6/I6: a confidential tool keeps its output out of the exported step
      // record — console, audit and receipt carry the hash. The run context
      // (never exported) keeps the value for later steps and branches.
      const stepResult = confidentialTools.has(step.tool)
        ? { ok: true, confidential: true, outputHash: await canonicalPayloadHash(result) }
        : result;
      await setStep(store, run, step.id, { status: "done", result: stepResult, endedAt: new Date().toISOString() });
      run.currentStepId = pickNext(step, run.context);
      continue;
    }

    if (step.type === "approval") {
      const required = quorumFor(step, policy, run.context);
      const writeStep = nextToolCall(definition, step, run.context);
      const frozen = {
        tool: writeStep?.tool || "tool_call",
        input: contextForTool(writeStep || step, run.context),
      };
      run.context = { ...run.context, pendingWrite: frozen };
      const approval = await bindApprovalPayload(store, {
        projectId: run.projectId,
        runId: run.id,
        stepId: step.id,
        tool: frozen.tool,
        input: frozen.input,
        required,
      });
      const dueAt = new Date(stamp + (step.timeout?.afterMs || 86_400_000)).toISOString();
      await store.createTask({
        projectId: run.projectId,
        runId: run.id,
        stepId: step.id,
        role: (step.roles || [])[0] || "owner",
        dueAt,
        status: "open",
      });
      run.status = "waiting";
      run.context = { ...run.context, approvalId: approval.id, payloadHash: approval.payloadHash };
      await setStep(store, run, step.id, { status: "waiting" });
      await store.saveRun(run);
      if (env?.OPS_ROOM_STORAGE) {
        await scheduleDoAlarmJob(env.OPS_ROOM_STORAGE, `ops:${run.id}:${step.id}`, new Date(dueAt).getTime(), "ops-timeout");
      }
      await emit(env, store, run, "ops.approval.requested", { approvalId: approval.id, required }, actor);
      // Notify last: a slow notification fan-out must never leave the run
      // unsaved, and the fan-out is best-effort anyway.
      const { notifyOpsApprovalOffRoom } = await import("./ops-approval-notify.js");
      await notifyOpsApprovalOffRoom(env, {
        projectId: run.projectId,
        roomId: run.roomId,
        runId: run.id,
        approvalId: approval.id,
        stepId: step.id,
        tool: frozen.tool,
        input: frozen.input,
        required,
        dueAt,
        payloadHash: approval.payloadHash,
      }).catch(() => {});
      return run;
    }

    if (step.type === "human_task") {
      await store.createTask({
        projectId: run.projectId,
        runId: run.id,
        stepId: step.id,
        assignee: step.assignee?.userId || null,
        role: step.assignee?.role || "member",
        dueAt: new Date(stamp + (step.timeout?.afterMs || 86_400_000)).toISOString(),
        status: "open",
      });
      run.status = "waiting";
      await emit(env, store, run, "ops.task.assigned", { stepId: step.id, role: step.assignee?.role }, actor);
      await setStep(store, run, step.id, { status: "waiting" });
      await store.saveRun(run);
      return run;
    }

    if (step.type === "wait_for_guest") {
      const emailKey = step.guest?.emailFrom || "guest_email";
      const email = String(run.context?.[emailKey] || run.context?.guestEmail || "").trim();
      if (email) {
        const issued = await issueOpsGuestInvite(store, {
          projectId: run.projectId,
          runId: run.id,
          email,
          can: step.guest?.can,
          secret: env?.JWT_SECRET,
        });
        run.context = {
          ...run.context,
          guestInviteId: issued.guest?.id,
          guestToken: issued.token,
          guestCan: issued.can,
        };
      }
      run.status = "waiting";
      await emit(env, store, run, "ops.guest.waiting", { stepId: step.id, can: step.guest?.can, email: email || null }, actor);
      await setStep(store, run, step.id, { status: "waiting" });
      await store.saveRun(run);
      return run;
    }

    if (step.type === "notify" || step.type === "branch") {
      await setStep(store, run, step.id, { status: "done", endedAt: new Date().toISOString() });
      run.currentStepId = pickNext(step, run.context);
      continue;
    }

    run.currentStepId = pickNext(step, run.context);
  }
  await store.saveRun(run);
  return run;
}

export async function completeOpsTask(store, { env, projectId, taskId, actor, contextPatch, executeTool }) {
  const task = await store.getTask(projectId, taskId);
  if (!task) return { ok: false, error: "not_found" };
  // A completed/expired task must not advance the run again (a double POST
  // would re-execute the steps after it), and a cancelled run must not resume.
  if (task.status !== "open") return { ok: false, error: "already_completed" };
  const run = await store.getRun(projectId, task.runId);
  if (!run) return { ok: false, error: "not_found" };
  if (run.status !== "waiting") return { ok: false, error: "run_not_waiting" };
  task.status = "done";
  await store.saveTask(task);
  const version = await store.getVersion(projectId, run.versionId);
  run.status = "running";
  run.context = { ...run.context, ...(contextPatch || {}) };
  const step = findStep(version.definition, task.stepId);
  run.currentStepId = pickNext(step, run.context);
  await advanceOpsRun(store, { env, run, definition: version.definition, policy: await store.getPolicy(projectId), actor, executeTool });
  return { ok: true, run };
}

export async function decideRunApproval(store, args) {
  // A cancelled or timed-out run must not be revived by a late decision.
  const pending = await store.getApproval(args.projectId, args.approvalId);
  if (!pending) return { ok: false, error: "not_found" };
  const waitingRun = await store.getRun(args.projectId, pending.runId);
  if (waitingRun && waitingRun.status !== "waiting") return { ok: false, error: "run_not_waiting" };
  const result = await decideOpsApproval(store, args);
  if (!result.ok) return result;
  const approval = result.approval;
  const run = await store.getRun(args.projectId, approval.runId);
  if (!run) return { ok: false, error: "not_found" };
  if (approval.status !== "approved" && approval.status !== "denied") {
    // Quorum still open: let the room see the vote land.
    await emit(args.env, store, run, "ops.approval.vote", {
      approvalId: approval.id,
      decision: args.decision,
      approvals: approval.decisions.filter((item) => item.decision === "approve").length,
      required: approval.required || 1,
    }, args.actor);
    return result;
  }
  // Close the waiting task: a decided approval must leave the inbox, and a
  // stale open task would be expired later by processOpsRunAlarms and fail the
  // run while it waits on a *new* approval step.
  const openTasks = await store.listOpenTasks(args.projectId);
  for (const task of openTasks) {
    if (task.runId === approval.runId && task.stepId === approval.stepId) {
      task.status = "done";
      await store.saveTask(task);
    }
  }
  const version = await store.getVersion(args.projectId, run.versionId);
  const step = findStep(version.definition, approval.stepId);
  // A grant already emits ops.approval.granted (single-use, hash-bound); only
  // the denial has no event of its own.
  if (approval.status === "denied") {
    await emit(args.env, store, run, "ops.approval.denied", {
      approvalId: approval.id,
      decisions: approval.decisions.length,
      required: approval.required || 1,
    }, args.actor);
    run.status = "failed";
    await store.saveRun(run);
    return result;
  }
  run.status = "running";
  // An adaptive gate (I2) binds its approval to the tool step itself: the
  // approval means "run this call", not "move past the step".
  run.currentStepId = step?.type === "tool_call" ? step.id : pickNext(step, run.context);
  await advanceOpsRun(store, {
    env: args.env,
    run,
    definition: version.definition,
    policy: await store.getPolicy(args.projectId),
    actor: args.actor,
    executeTool: args.executeTool,
  });
  return { ...result, run };
}

/**
 * MRTR answers come from the room as free-form content; keep the shape the
 * spec expects and bound it so a run context cannot be flooded.
 */
function normalizeInputResponses(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const responses = [];
  for (const item of raw.slice(0, 4)) {
    const id = String(item?.id || "").trim().slice(0, 128);
    const content = item?.content;
    if (!id || !content || typeof content !== "object" || Array.isArray(content)) continue;
    let json;
    try {
      json = JSON.stringify(content);
    } catch {
      continue;
    }
    if (json.length > 16_384) continue;
    responses.push({ id, result: { action: item.action === "decline" ? "decline" : "accept", content } });
  }
  return responses.length ? responses : null;
}

/**
 * Answer a pending MRTR input request and resume the run: the tool_call step
 * re-executes the same call with inputResponses/requestState.
 */
export async function answerOpsInput(store, { env, projectId, runId, responses, actor, executeTool } = {}) {
  const run = await store.getRun(projectId, runId);
  if (!run) return { ok: false, error: "not_found" };
  if (run.status !== "waiting") return { ok: false, error: "run_not_waiting" };
  const pending = run.context?.pendingInput;
  if (!pending?.stepId) return { ok: false, error: "no_pending_input" };
  const answers = normalizeInputResponses(responses);
  if (!answers) return { ok: false, error: "invalid_responses" };
  const version = await store.getVersion(projectId, run.versionId);
  if (!version) return { ok: false, error: "not_found" };
  run.context = {
    ...run.context,
    pendingInput: { ...pending, answers, answeredBy: actor || null, answeredAt: new Date().toISOString() },
  };
  run.status = "running";
  await store.saveRun(run);
  // No content in the event: the answer is for the server, the room only needs
  // to know it landed (who answered, which request).
  await emit(env, store, run, "ops.tool.input_answered", {
    stepId: pending.stepId,
    tool: pending.tool,
    requestId: answers[0]?.id || null,
  }, actor);
  await advanceOpsRun(store, {
    env,
    run,
    definition: version.definition,
    policy: await store.getPolicy(projectId),
    actor,
    executeTool,
  });
  return { ok: true, run };
}

/** Waiting runs with a pending MRTR input request, for the console and room cards. */
export async function listPendingInputs(store, projectId) {
  const runs = await store.listRuns(projectId);
  return runs
    .filter((run) => run.status === "waiting" && run.context?.pendingInput?.stepId)
    .map((run) => {
      const pending = run.context.pendingInput;
      const request = (pending.requests || [])[0] || null;
      return {
        runId: run.id,
        roomId: run.roomId || null,
        stepId: pending.stepId,
        tool: pending.tool,
        server: pending.server || null,
        message: String(request?.params?.message || "Input required").slice(0, 500),
        requestId: request?.id || null,
        requestedSchema: request?.params?.requestedSchema || null,
        askedAt: pending.askedAt || null,
      };
    });
}

/**
 * Terminate the work a run still has open: tasks leave the inbox and pending
 * approvals become void, so a late tap or console decision cannot revive a
 * cancelled/timed-out run.
 */
export async function closeOpsRunWork(store, { projectId, runId }) {
  for (const task of await store.listOpenTasks(projectId)) {
    if (task.runId === runId) {
      task.status = "expired";
      await store.saveTask(task);
    }
  }
  for (const approval of await store.listApprovals(projectId, { status: "pending" })) {
    if (approval.runId === runId) {
      approval.status = "void";
      await store.saveApproval(approval);
    }
  }
}

export async function processOpsRunAlarms(env, store, { projectId, roomId }) {
  const run = await store.getRunByRoom(projectId, roomId);
  if (!run || run.status !== "waiting") return { ok: true, skipped: true };
  const tasks = (await store.listOpenTasks(projectId)).filter((task) => task.runId === run.id);
  const now = Date.now();
  const due = tasks.filter((task) => task.dueAt && Date.parse(task.dueAt) <= now);
  if (!due.length) return { ok: true, run };

  const version = await store.getVersion(projectId, run.versionId);
  const definition = version ? normalizeOpsDefinition(version.definition) : null;
  let remainingDue = false;
  for (const task of due) {
    const step = definition ? findStep(definition, task.stepId) : null;
    // A step may opt into one on-call page before the timeout fails the run
    // (`timeout.onTimeout: "escalate"`); the second deadline failing is the end.
    if (step?.timeout?.onTimeout === "escalate" && !run.context?.escalatedTasks?.[task.id]) {
      const escalated = await escalateOpsTask(env, store, { run, task, step }).catch(() => null);
      if (escalated?.ok) continue;
    }
    remainingDue = true;
  }
  if (remainingDue) {
    run.status = "failed";
    await store.saveRun(run);
    await closeOpsRunWork(store, { projectId, runId: run.id });
  }
  return { ok: true, run };
}

/**
 * One escalation per task: hand it to whoever is on call for the run's room,
 * give it a fresh window (`escalationMinutes` of the schedule), and page them.
 */
async function escalateOpsTask(env, store, { run, task, step }) {
  if (!env?.DB?.prepare) return { ok: false, error: "no_db" };
  const { listSchedules, getCurrentOnCall } = await import("./oncall-collaboration.js");
  const schedules = await listSchedules(env, { projectId: run.projectId, roomId: run.roomId });
  const schedule = schedules.find((item) => item.enabled) || schedules[0] || null;
  if (!schedule) return { ok: false, error: "no_schedule" };
  const shift = await getCurrentOnCall(env, { projectId: run.projectId, scheduleId: schedule.id });
  if (!shift?.userId) return { ok: false, error: "no_oncall" };

  const minutes = Number(schedule.escalationMinutes) || 30;
  const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const at = new Date().toISOString();
  task.assignee = shift.userId;
  task.dueAt = dueAt;
  await store.saveTask(task);
  run.context = {
    ...run.context,
    escalatedTasks: { ...(run.context?.escalatedTasks || {}), [task.id]: { at, dueAt, to: shift.userId } },
  };
  await store.saveRun(run);
  if (env?.OPS_ROOM_STORAGE) {
    await scheduleDoAlarmJob(env.OPS_ROOM_STORAGE, `ops:${run.id}:${step.id}`, new Date(dueAt).getTime(), "ops-timeout").catch(() => {});
  }
  await emit(env, store, run, "ops.task.escalated", {
    taskId: task.id,
    stepId: step.id,
    to: shift.userId,
    via: "oncall",
    dueAt,
  }, "system");
  const { notifyOpsTaskEscalation } = await import("./ops-approval-notify.js");
  await notifyOpsTaskEscalation(env, {
    projectId: run.projectId,
    roomId: run.roomId,
    runId: run.id,
    userId: shift.userId,
    stepId: step.id,
    taskId: task.id,
    dueAt,
  }).catch(() => {});
  return { ok: true, to: shift.userId, dueAt };
}
