import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { findStep, normalizeOpsDefinition } from "./ops-definition.js";
import { evalJsonLogic } from "./ops-jsonlogic.js";
import { bindApprovalPayload, createOpsToolGateway, decideOpsApproval } from "./ops-gateway.js";
import { normalizeOpsPolicy } from "./ops-policy.js";
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
  if (context?.pendingWrite?.tool === step.tool) return context.pendingWrite.input;
  const {
    approvalId,
    payloadHash,
    pendingWrite,
    pendingTool,
    injectionIgnored,
    lastToolResult,
    ...rest
  } = context || {};
  return { ...(step.input || {}), ...rest };
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
 * Generic interpreter. No per-process branches.
 */
export async function startOpsRun(store, {
  env,
  projectId,
  version,
  trigger,
  context,
  actor,
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
    trigger: trigger || { type: "manual" },
    context: context || {},
    currentStepId: startStep.id,
    killSwitch: false,
    cost: { toolCalls: 0, tokens: 0 },
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
  const definition = rawDefinition?.steps?.[0]?.timeout?.afterMs
    ? rawDefinition
    : normalizeOpsDefinition(rawDefinition);
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
      const input = contextForTool(step, run.context);
      const result = await gateway.call(step.tool, input, { actor, simulate });
      if (!result.ok && result.error === "approval_required") {
        run.status = "waiting";
        await setStep(store, run, step.id, { status: "waiting", result });
        await store.saveRun(run);
        return run;
      }
      if (!result.ok) {
        run.status = "failed";
        await setStep(store, run, step.id, { status: "failed", error: result.error });
        await store.saveRun(run);
        return run;
      }
      run.context = { ...run.context, lastToolResult: result };
      await setStep(store, run, step.id, { status: "done", result, endedAt: new Date().toISOString() });
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
      await store.createTask({
        projectId: run.projectId,
        runId: run.id,
        stepId: step.id,
        role: (step.roles || [])[0] || "owner",
        dueAt: new Date(stamp + (step.timeout?.afterMs || 86_400_000)).toISOString(),
        status: "open",
      });
      run.status = "waiting";
      run.context = { ...run.context, approvalId: approval.id, payloadHash: approval.payloadHash };
      await emit(env, store, run, "ops.approval.requested", { approvalId: approval.id, required }, actor);
      await setStep(store, run, step.id, { status: "waiting" });
      await store.saveRun(run);
      if (env?.OPS_ROOM_STORAGE) {
        await scheduleDoAlarmJob(env.OPS_ROOM_STORAGE, `ops:${run.id}:${step.id}`, stamp + step.timeout.afterMs, "ops-timeout");
      }
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

export async function completeOpsTask(store, { env, projectId, taskId, actor, contextPatch }) {
  const task = await store.getTask(projectId, taskId);
  if (!task) return { ok: false, error: "not_found" };
  task.status = "done";
  await store.saveTask(task);
  const run = await store.getRun(projectId, task.runId);
  const version = await store.getVersion(projectId, run.versionId);
  run.status = "running";
  run.context = { ...run.context, ...(contextPatch || {}) };
  const step = findStep(version.definition, task.stepId);
  run.currentStepId = pickNext(step, run.context);
  await advanceOpsRun(store, { env, run, definition: version.definition, policy: await store.getPolicy(projectId), actor });
  return { ok: true, run };
}

export async function decideRunApproval(store, args) {
  const result = await decideOpsApproval(store, args);
  if (!result.ok) return result;
  if (result.approval.status !== "approved" && result.approval.status !== "denied") return result;
  const run = await store.getRun(args.projectId, result.approval.runId);
  const version = await store.getVersion(args.projectId, run.versionId);
  const step = findStep(version.definition, result.approval.stepId);
  if (result.approval.status === "denied") {
    run.status = "failed";
    await store.saveRun(run);
    return result;
  }
  run.status = "running";
  run.currentStepId = pickNext(step, run.context);
  await advanceOpsRun(store, {
    env: args.env,
    run,
    definition: version.definition,
    policy: await store.getPolicy(args.projectId),
    actor: args.actor,
  });
  return { ...result, run };
}

export async function processOpsRunAlarms(env, store, { projectId, roomId }) {
  const run = await store.getRunByRoom(projectId, roomId);
  if (!run || run.status !== "waiting") return { ok: true, skipped: true };
  const tasks = (await store.listOpenTasks(projectId)).filter((task) => task.runId === run.id);
  const now = Date.now();
  for (const task of tasks) {
    if (task.dueAt && Date.parse(task.dueAt) <= now) {
      task.status = "expired";
      await store.saveTask(task);
      run.status = "failed";
      await store.saveRun(run);
    }
  }
  return { ok: true, run };
}
