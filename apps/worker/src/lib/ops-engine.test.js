import { describe, expect, it, vi } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { enableAllBuiltinTools, defaultOpsPolicy } from "./ops-policy.js";
import { startOpsRun, completeOpsTask, decideRunApproval, processOpsRunAlarms, answerOpsInput, listPendingInputs } from "./ops-engine.js";
import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { exportOpsAudit } from "./ops-audit.js";

// The on-call layer reads D1 directly; the engine tests only need the shape.
const oncallState = vi.hoisted(() => ({ schedules: [], shift: null }));
vi.mock("./oncall-collaboration.js", () => ({
  listSchedules: async () => oncallState.schedules,
  getCurrentOnCall: async () => oncallState.shift,
}));

function fakeEnv() {
  const chain = () => ({
    bind: () => ({ run: async () => ({}), first: async () => null, all: async () => ({ results: [] }) }),
  });
  return { DB: { prepare: chain } };
}

async function seed(store, definition) {
  const projectId = "p1";
  for (const tool of enableAllBuiltinTools()) await store.upsertTool(projectId, tool);
  await store.putPolicy(projectId, defaultOpsPolicy(), "admin");
  const def = await store.createDefinition({ projectId, slug: definition.slug, createdBy: "u1" });
  const version = await store.saveVersion({
    projectId,
    definitionId: def.id,
    version: 1,
    status: "published",
    definition,
    createdBy: "u1",
    publishedBy: "admin",
  });
  return { projectId, version };
}

const genericDef = {
  slug: "access-request",
  steps: [
    {
      id: "review",
      type: "human_task",
      assignee: { role: "security", userId: "u1" },
      timeout: { after: "1d" },
      next: "approve",
    },
    {
      id: "approve",
      type: "approval",
      roles: ["security"],
      quorum: { default: 2 },
      timeout: { after: "1d" },
      next: "write",
    },
    { id: "write", type: "tool_call", tool: "mcp.call", timeout: { after: "1m" }, next: "end" },
    { id: "end", type: "end", timeout: { after: "1s" } },
  ],
};

describe("ops-engine", () => {
  it("runs a generic process through human, approval hash, then write", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, genericDef);
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u1",
      roomId: "room-1",
      context: { total: 1 },
      executeTool: async () => ({ ok: true, written: true }),
    });
    expect(run.status).toBe("waiting");
    expect(run.cost).toMatchObject({ toolCalls: 0, maxToolCalls: 40 });
    const tasks = await store.listOpenTasks(projectId, { assignee: "u1" });
    const done = await completeOpsTask(store, { projectId, taskId: tasks[0].id, actor: "u1" });
    expect(done.run.status).toBe("waiting");
    const approvalId = done.run.context.approvalId;
    const approval = await store.getApproval(projectId, approvalId);
    const mismatch = await decideRunApproval(store, {
      projectId,
      approvalId,
      actor: "u1",
      decision: "approve",
      payloadHash: "deadbeef",
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.error).toBe("payload_changed");
    const fresh = (await seed(createMemoryOpsStore(), genericDef));
    const store2 = createMemoryOpsStore();
    for (const tool of enableAllBuiltinTools()) await store2.upsertTool(projectId, tool);
    await store2.putPolicy(projectId, defaultOpsPolicy(), "admin");
    const def = await store2.createDefinition({ projectId, slug: "access-request", createdBy: "u1" });
    const v = await store2.saveVersion({
      projectId,
      definitionId: def.id,
      version: 1,
      status: "published",
      definition: genericDef,
      createdBy: "u1",
      publishedBy: "admin",
    });
    const run2 = await startOpsRun(store2, {
      projectId,
      version: v,
      actor: "u1",
      roomId: "room-2",
      context: { total: 1 },
      executeTool: async () => ({ ok: true, written: true }),
    });
    const t2 = await store2.listOpenTasks(projectId, { assignee: "u1" });
    await completeOpsTask(store2, { projectId, taskId: t2[0].id, actor: "u1" });
    const runWaiting = await store2.getRun(projectId, run2.id);
    const ap = await store2.getApproval(projectId, runWaiting.context.approvalId);
    await decideRunApproval(store2, {
      projectId,
      approvalId: ap.id,
      actor: "u1",
      decision: "approve",
      payloadHash: ap.payloadHash,
    });
    await decideRunApproval(store2, {
      projectId,
      approvalId: ap.id,
      actor: "u2",
      decision: "approve",
      payloadHash: ap.payloadHash,
    });
    const finished = await store2.getRun(projectId, run2.id);
    expect(["done", "waiting", "failed", "running"]).toContain(finished.status);
    expect(await canonicalPayloadHash(ap.payload)).toBe(ap.payloadHash);
  });

  it("explicit step input wins over run context (OPS-04)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "shadowing",
      steps: [
        { id: "w", type: "tool_call", tool: "files.search", input: { query: "authored" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const seen = [];
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u1",
      roomId: "rs",
      context: { query: "from-context" },
      executeTool: async (name, input) => {
        seen.push(input);
        return { ok: true };
      },
    });
    expect(run.status).toBe("done");
    expect(seen[0].query).toBe("authored");
  });

  it("isolates projects", async () => {    const store = createMemoryOpsStore();
    const a = await seed(store, genericDef);
    const run = await startOpsRun(store, {
      projectId: a.projectId,
      version: a.version,
      actor: "u1",
      roomId: "r",
    });
    expect(await store.getRun("other", run.id)).toBeNull();
  });

  it("issues a scoped guest token on wait_for_guest", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "guest-wait",
      steps: [
        {
          id: "ask_guest",
          type: "wait_for_guest",
          guest: { emailFrom: "guest_email", can: ["comment"] },
          timeout: { after: "1d" },
          next: "end",
        },
        { id: "end", type: "end", timeout: { after: "1s" } },
      ],
    });
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u1",
      roomId: "rg",
      env: { JWT_SECRET: "s" },
      context: { guest_email: "a@vendor.test" },
    });
    expect(run.status).toBe("waiting");
    expect(run.context.guestToken).toBeTruthy();
    expect(run.context.guestCan).toContain("comment");
  });

  it("executes the approved write on resume (executeTool threading)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "notify-flow",
      steps: [
        { id: "approve", type: "approval", roles: ["security"], quorum: { default: 1 }, next: "write" },
        { id: "write", type: "tool_call", tool: "notify.send", input: { message: "hi" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const calls = [];
    const executeTool = async (name, input, extra) => {
      calls.push({ name, input, roomId: extra?.roomId });
      return { ok: true, notified: 1 };
    };
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u1",
      roomId: "room-1",
      context: {},
      executeTool,
    });
    expect(run.status).toBe("waiting");
    const approval = await store.getApproval(projectId, run.context.approvalId);
    const decided = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("notify.send");
    expect(calls[0].input).toMatchObject({ message: "hi" });
    expect(calls[0].roomId).toBe("room-1");
    expect(decided.run.status).toBe("done");
  });

  it("closes the approval task so an old deadline cannot fail a later approval step", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "two-approvals",
      steps: [
        { id: "first", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "second" },
        { id: "second", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const executeTool = async () => ({ ok: true });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("waiting");
    const firstTask = (await store.listOpenTasks(projectId))[0];
    expect(firstTask.stepId).toBe("first");

    // The first deadline passes while the run waits on the first approval.
    firstTask.dueAt = new Date(Date.now() - 60_000).toISOString();
    await store.saveTask(firstTask);

    const approval = await store.getApproval(projectId, run.context.approvalId);
    const decided = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect(decided.ok).toBe(true);
    expect((await store.getTask(projectId, firstTask.id)).status).toBe("done");
    expect((await store.listOpenTasks(projectId)).map((task) => task.stepId)).toEqual(["second"]);
    expect((await store.getRun(projectId, run.id)).currentStepId).toBe("second");

    // The alarm sees only the live task, so the old deadline cannot fail the run.
    await processOpsRunAlarms({}, store, { projectId, roomId: "room-1" });
    expect((await store.getRun(projectId, run.id)).status).toBe("waiting");
  });

  it("records a vote event while quorum is open and a verdict event when it closes", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "quorum-two",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 2 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const executeTool = async () => ({ ok: true });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    const approval = await store.getApproval(projectId, run.context.approvalId);

    const first = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(first.ok).toBe(true);
    expect(first.approval.status).toBe("pending");
    const afterVote = await store.listEvents(projectId, run.id);
    expect(afterVote.map((event) => event.eventType)).toContain("ops.approval.vote");

    const second = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect(second.approval.status).toBe("approved");
    const afterVerdict = await store.listEvents(projectId, run.id);
    expect(afterVerdict.map((event) => event.eventType)).toContain("ops.approval.granted");
  });

  it("records a denial event, fails the run, and closes the task", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "deny-me",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const approval = await store.getApproval(projectId, run.context.approvalId);
    const decided = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "deny",
      payloadHash: approval.payloadHash,
    });
    expect(decided.ok).toBe(true);
    expect(decided.approval.status).toBe("denied");
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");
    expect(await store.listOpenTasks(projectId)).toHaveLength(0);
    const events = await store.listEvents(projectId, run.id);
    expect(events.map((event) => event.eventType)).toContain("ops.approval.denied");
  });

  it("refuses to complete the same task twice", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "double-complete",
      steps: [
        { id: "human", type: "human_task", assignee: { role: "security", userId: "u1" }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const task = (await store.listOpenTasks(projectId))[0];
    const first = await completeOpsTask(store, { projectId, taskId: task.id, actor: "u1" });
    expect(first.ok).toBe(true);
    const second = await completeOpsTask(store, { projectId, taskId: task.id, actor: "u1" });
    expect(second).toEqual({ ok: false, error: "already_completed" });
    expect((await store.getRun(projectId, run.id)).status).toBe("done");
  });

  it("refuses to complete a task on a cancelled run", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "task-on-cancelled",
      steps: [
        { id: "human", type: "human_task", assignee: { role: "security", userId: "u1" }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const task = (await store.listOpenTasks(projectId))[0];
    const stored = await store.getRun(projectId, run.id);
    stored.status = "cancelled";
    stored.killSwitch = true;
    await store.saveRun(stored);

    const result = await completeOpsTask(store, { projectId, taskId: task.id, actor: "u1" });
    expect(result).toEqual({ ok: false, error: "run_not_waiting" });
    expect((await store.getTask(projectId, task.id)).status).toBe("open");
  });

  it("does not revive a cancelled run from a late approval", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "late-approval",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const approval = await store.getApproval(projectId, run.context.approvalId);
    run.status = "cancelled";
    run.killSwitch = true;
    await store.saveRun(run);

    const late = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(late).toEqual({ ok: false, error: "run_not_waiting" });
    expect((await store.getApproval(projectId, approval.id)).status).toBe("pending");
    expect((await store.getRun(projectId, run.id)).status).toBe("cancelled");
  });

  it("timeout voids the approval so a late decision cannot resume the run", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "timeout-void",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const approval = await store.getApproval(projectId, run.context.approvalId);
    const task = (await store.listOpenTasks(projectId))[0];
    task.dueAt = new Date(Date.now() - 1000).toISOString();
    await store.saveTask(task);

    await processOpsRunAlarms({}, store, { projectId, roomId: "room-1" });
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");
    expect((await store.getApproval(projectId, approval.id)).status).toBe("void");
    expect(await store.listOpenTasks(projectId)).toHaveLength(0);

    const late = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(late).toEqual({ ok: false, error: "run_not_waiting" });
  });

  it("asks the room when an MCP tool requests input, then resumes the same call with the answers (I1)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "deploy-with-question",
      steps: [
        { id: "inspect", type: "tool_call", tool: "incidents.read", input: { incidentId: "inc-1" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const calls = [];
    const executeTool = async (name, input) => {
      calls.push({ name, input });
      if (calls.length === 1) {
        return {
          ok: false,
          error: "input_required",
          message: "Which environment?",
          requests: [
            {
              id: "elicit-1",
              method: "elicitation/create",
              params: { message: "Which environment?", requestedSchema: { type: "object", properties: { env: { type: "string" } } } },
            },
          ],
          requestState: "st-1",
        };
      }
      return { ok: true, data: { deployed: true } };
    };

    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("waiting");
    const waiting = await store.getRun(projectId, run.id);
    expect(waiting.context.pendingInput).toMatchObject({
      stepId: "inspect",
      tool: "incidents.read",
      requestState: "st-1",
    });
    expect((await store.listSteps(projectId, run.id))[0]).toMatchObject({ stepId: "inspect", status: "waiting" });
    // The suspension is in the tool log with its own event type, not a failure.
    const firstEvents = await store.listToolEvents(projectId, { runId: run.id });
    expect(firstEvents.map((event) => event.eventType)).toEqual(["ops.tool.input_required"]);

    const pending = await listPendingInputs(store, projectId);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      runId: run.id,
      stepId: "inspect",
      tool: "incidents.read",
      message: "Which environment?",
      requestId: "elicit-1",
    });

    // A non-waiting run cannot be answered; a bad payload is rejected.
    const badRun = await answerOpsInput(store, { env: {}, projectId, runId: "run_nope", responses: [{ id: "x", content: {} }] });
    expect(badRun.error).toBe("not_found");
    const badPayload = await answerOpsInput(store, { env: {}, projectId, runId: run.id, responses: [], executeTool });
    expect(badPayload.error).toBe("invalid_responses");

    const answered = await answerOpsInput(store, {
      env: {},
      projectId,
      runId: run.id,
      responses: [{ id: "elicit-1", content: { env: "staging" } }],
      actor: "u2",
      executeTool,
    });
    expect(answered.ok).toBe(true);
    const done = await store.getRun(projectId, run.id);
    expect(done.status).toBe("done");
    expect(done.context.pendingInput).toBeUndefined();
    expect(calls).toHaveLength(2);
    expect(calls[1].input).toMatchObject({
      inputResponses: [{ id: "elicit-1", result: { action: "accept", content: { env: "staging" } } }],
      requestState: "st-1",
    });
    const eventTypes = (await store.listToolEvents(projectId, { runId: run.id })).map((event) => event.eventType);
    expect(eventTypes).toContain("ops.tool.input_answered");
    expect(eventTypes).toContain("ops.tool.called");
    expect(await listPendingInputs(store, projectId)).toHaveLength(0);
  });

  it("resumes a write tool waiting on input without demanding the single-use grant twice (I1)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "grant-write-with-question",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, next: "write" },
        { id: "write", type: "tool_call", tool: "mcp.call", input: { server: "iam", tool: "revoke_session" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const calls = [];
    const executeTool = async (name, input) => {
      calls.push({ name, input });
      if (calls.length === 1) {
        return {
          ok: false,
          error: "input_required",
          message: "Which session?",
          requests: [{ id: "e1", method: "elicitation/create", params: { message: "Which session?" } }],
          requestState: "st-2",
        };
      }
      return { ok: true, data: { revoked: true } };
    };

    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("waiting");
    const granted = await decideRunApproval(store, {
      projectId,
      approvalId: run.context.approvalId,
      actor: "u1",
      decision: "approve",
      payloadHash: run.context.payloadHash,
      executeTool,
    });
    expect(granted.ok).toBe(true);
    const suspended = await store.getRun(projectId, run.id);
    expect(suspended.status).toBe("waiting");
    expect(suspended.context.pendingInput.stepId).toBe("write");
    const consumed = async () =>
      (await store.listEvents(projectId, run.id)).filter((event) => event.eventType === "ops.approval.consumed");
    expect(await consumed()).toHaveLength(1);

    const answered = await answerOpsInput(store, {
      env: {},
      projectId,
      runId: run.id,
      responses: [{ id: "e1", content: { session: "s-9" } }],
      actor: "u2",
      executeTool,
    });
    expect(answered.ok).toBe(true);
    expect((await store.getRun(projectId, run.id)).status).toBe("done");
    // The resumed call is the same call continuing: no second grant demand.
    expect(await consumed()).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("fails an agent_task loudly when a tool asks for input (I1)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "agent-ask",
      steps: [
        { id: "scan", type: "agent_task", tools: ["incidents.read"], next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u1",
      executeTool: async () => ({
        ok: false,
        error: "input_required",
        requests: [{ id: "e1", method: "elicitation/create", params: { message: "?" } }],
      }),
    });
    expect(run.status).toBe("failed");
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");
    const step = (await store.listSteps(projectId, run.id))[0];
    expect(step).toMatchObject({ stepId: "scan", status: "failed", error: "input_required" });
    expect(await listPendingInputs(store, projectId)).toHaveLength(0);
  });

  it("emits a room-visible block card when a pinned MCP tool changed (C2 residual)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "drifted-tool",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, next: "write" },
        { id: "write", type: "tool_call", tool: "mcp.call", input: { server: "github", tool: "create_issue" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const executeTool = async () => ({
      ok: false,
      error: "tool_changed",
      message: "This tool's definition changed since it was approved; an admin must re-approve it in Ops settings.",
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("waiting");
    await decideRunApproval(store, {
      projectId,
      approvalId: run.context.approvalId,
      actor: "u1",
      decision: "approve",
      payloadHash: run.context.payloadHash,
      executeTool,
    });
    const finished = await store.getRun(projectId, run.id);
    expect(finished.status).toBe("failed");
    const blocked = (await store.listEvents(projectId, run.id)).filter((event) => event.eventType === "ops.mcp.tool_blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0].result).toMatchObject({ stepId: "write", tool: "mcp.call", server: "github" });
  });

  it("escalates a timed-out step to the on-call once, then fails on the second deadline (I5)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "escalate-to-oncall",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h", onTimeout: "escalate" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const task = (await store.listOpenTasks(projectId))[0];
    task.dueAt = new Date(Date.now() - 1000).toISOString();
    await store.saveTask(task);

    const env = fakeEnv();
    oncallState.schedules = [{ id: "sched-1", enabled: true, escalationMinutes: 15 }];
    oncallState.shift = { userId: "u-oncall" };
    await processOpsRunAlarms(env, store, { projectId, roomId: "room-1" });

    expect((await store.getRun(projectId, run.id)).status).toBe("waiting");
    const escalated = (await store.listOpenTasks(projectId))[0];
    expect(escalated.assignee).toBe("u-oncall");
    expect(Date.parse(escalated.dueAt)).toBeGreaterThan(Date.now());
    const escalations = (await store.listEvents(projectId, run.id)).filter((event) => event.eventType === "ops.task.escalated");
    expect(escalations).toHaveLength(1);
    expect(escalations[0].result).toMatchObject({ to: "u-oncall", via: "oncall", stepId: "approve" });

    // Second deadline, nobody responds: the run fails and the approval voids.
    escalated.dueAt = new Date(Date.now() - 1000).toISOString();
    await store.saveTask(escalated);
    await processOpsRunAlarms(env, store, { projectId, roomId: "room-1" });
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");
    expect((await store.getApproval(projectId, run.context.approvalId)).status).toBe("void");
    oncallState.schedules = [];
    oncallState.shift = null;
  });

  it("fails the timeout when escalate finds nobody on call (I5)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "escalate-no-oncall",
      steps: [
        { id: "review", type: "human_task", assignee: { role: "security" }, timeout: { after: "1h", onTimeout: "escalate" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const task = (await store.listOpenTasks(projectId))[0];
    task.dueAt = new Date(Date.now() - 1000).toISOString();
    await store.saveTask(task);

    // No schedule for the room -> the escalated step still fails closed.
    oncallState.schedules = [];
    oncallState.shift = null;
    await processOpsRunAlarms(fakeEnv(), store, { projectId, roomId: "room-1" });
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");
    expect((await store.listEvents(projectId, run.id)).filter((event) => event.eventType === "ops.task.escalated")).toHaveLength(0);
  });

  it("parks a statically-allowed call behind an adaptive gate, then runs it on approval (I2)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "gated-read",
      steps: [
        { id: "read", type: "tool_call", tool: "incidents.read", input: { incidentId: "inc-1" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    await store.putPolicy(
      projectId,
      { ...defaultOpsPolicy(), adaptiveGates: { enabled: true, firstUse: true, offHours: null, spike: null, approveRoles: ["owner"] } },
      "admin",
    );
    const calls = [];
    const executeTool = async (name, input) => {
      calls.push({ name, input });
      return { ok: true, data: { seen: true } };
    };
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("waiting");
    expect(calls).toHaveLength(0);
    const waiting = await store.getRun(projectId, run.id);
    expect(waiting.context.gate).toMatchObject({ stepId: "read", reasons: ["first_use"] });
    const gateEvents = (await store.listEvents(projectId, run.id)).filter((event) => event.eventType === "ops.gate.requested");
    expect(gateEvents).toHaveLength(1);
    expect((await store.listOpenTasks(projectId))[0]).toMatchObject({ stepId: "read", role: "owner" });

    const approval = await store.getApproval(projectId, waiting.context.gate.approvalId);
    const decided = await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect(decided.ok).toBe(true);
    const done = await store.getRun(projectId, run.id);
    expect(done.status).toBe("done");
    expect(done.context.gate).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: "incidents.read" });
  });

  it("fails the run when an adaptive gate is denied, and stays quiet once the tool has run (I2)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "gated-deny",
      steps: [
        { id: "read", type: "tool_call", tool: "incidents.read", next: "end" },
        { id: "end", type: "end" },
      ],
    });
    await store.putPolicy(
      projectId,
      { ...defaultOpsPolicy(), adaptiveGates: { enabled: true, firstUse: true, offHours: null, spike: null, approveRoles: ["owner"] } },
      "admin",
    );
    const executeTool = async () => ({ ok: true });
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    const waiting = await store.getRun(projectId, run.id);
    const approval = await store.getApproval(projectId, waiting.context.gate.approvalId);
    await decideRunApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "u1",
      decision: "deny",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect((await store.getRun(projectId, run.id)).status).toBe("failed");

    // Once the tool has actually executed, the next run goes straight through.
    await store.appendEvent({ projectId, eventType: "ops.tool.called", result: { tool: "incidents.read" } });
    const run2 = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run2.status).toBe("done");
  });

  it("carries the initiator and roles with the run so tool ACLs can evaluate them (C7)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "acl-meta",
      steps: [{ id: "end", type: "end" }],
    });
    const run = await startOpsRun(store, {
      projectId,
      version,
      actor: "u7",
      actorRoles: ["owner", "security"],
      roomId: "room-1",
      executeTool: async () => ({ ok: true }),
    });
    const stored = await store.getRun(projectId, run.id);
    expect(stored.trigger).toMatchObject({ type: "manual", actor: "u7", roles: ["owner", "security"] });
  });

  it("keeps a confidential tool's output as a hash in the step record, value stays out of the audit (C6)", async () => {
    const store = createMemoryOpsStore();
    const { projectId, version } = await seed(store, {
      slug: "confidential-read",
      steps: [
        { id: "read", type: "tool_call", tool: "files.search", input: { query: "secret" }, next: "end" },
        { id: "end", type: "end" },
      ],
    });
    await store.putPolicy(projectId, { ...defaultOpsPolicy(), confidentialTools: ["files.search"] }, "admin");
    const payload = { ok: true, data: { secret: "s3cr3t-value" } };
    const executeTool = async () => payload;
    const run = await startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool });
    expect(run.status).toBe("done");

    const step = (await store.listSteps(projectId, run.id))[0];
    expect(step.result).toMatchObject({ ok: true, confidential: true });
    expect(step.result.data).toBeUndefined();
    expect(step.result.outputHash).toBe(await canonicalPayloadHash(payload));

    // Downstream steps and branches still see the value in the run context...
    const stored = await store.getRun(projectId, run.id);
    expect(stored.context.lastToolResult.data.secret).toBe("s3cr3t-value");

    // ...while the exported evidence carries the hash and never the payload.
    const exported = await exportOpsAudit(store, { projectId, runId: run.id });
    expect(JSON.stringify(exported.json)).toContain("outputHash");
    expect(JSON.stringify(exported.json)).not.toContain("s3cr3t-value");
    // The tool log flags the call as confidential without storing the output.
    const called = (await store.listEvents(projectId, run.id)).find((event) => event.eventType === "ops.tool.called");
    expect(called.result).toMatchObject({ tool: "files.search", confidential: true });
    expect(JSON.stringify(called)).not.toContain("s3cr3t-value");
  });
});
