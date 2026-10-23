import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { bindApprovalPayload, createOpsToolGateway, decideOpsApproval } from "./ops-gateway.js";

const projectId = "p1";

async function seed() {
  const store = createMemoryOpsStore();
  await store.upsertTool(projectId, {
    name: "notify.send",
    side: "write",
    risk: "medium",
    enabled: true,
    requiresApproval: true,
    dataClasses: ["message"],
  });
  await store.putPolicy(projectId, defaultOpsPolicy(), "admin");
  const run = { id: "r1", projectId, killSwitch: false, cost: { toolCalls: 0, tokens: 0 } };
  const gateway = await createOpsToolGateway({
    store,
    projectId,
    run,
    definition: { steps: [{ id: "w", type: "tool_call", tool: "notify.send" }] },
    policy: await store.getPolicy(projectId),
    execute: async () => ({ ok: true, written: true }),
  });
  return { store, run, gateway };
}

async function grant(store, input) {
  const payload = { tool: "notify.send", input };
  return bindApprovalPayload(store, {
    projectId,
    runId: "r1",
    stepId: "s1",
    tool: payload.tool,
    input: payload.input,
    required: 2,
  });
}

describe("ops-gateway", () => {
  it("requires distinct approvers for quorum (OPS-03)", async () => {
    const { store } = await seed();
    const approval = await grant(store, { message: "hi" });
    const first = await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(first.ok).toBe(true);
    expect(first.approval.status).toBe("pending");
    const duplicate = await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toBe("duplicate_decision");
    const second = await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    expect(second.approval.status).toBe("approved");
  });

  it("logs every invocation: waiting, called and denied", async () => {
    const { store, gateway } = await seed();
    const input = { message: "hi" };
    const waiting = await gateway.call("notify.send", input, { actor: "u1" });
    expect(waiting.error).toBe("approval_required");
    const unknown = await gateway.call("does.not.exist", {}, { actor: "u1" });
    expect(unknown.ok).toBe(false);
    const approval = await grant(store, input);
    await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    const called = await gateway.call("notify.send", input, { actor: "u1" });
    expect(called.ok).toBe(true);

    const toolEvents = (await store.listEvents(projectId, "r1")).filter((event) =>
      event.eventType.startsWith("ops.tool."),
    );
    expect(toolEvents.map((event) => event.eventType)).toEqual([
      "ops.tool.approval_required",
      "ops.tool.denied",
      "ops.tool.called",
    ]);
    expect(toolEvents[0].result).toMatchObject({ ok: false, tool: "notify.send", payloadHash: approval.payloadHash });
    expect(toolEvents[1].result).toMatchObject({ ok: false, tool: "does.not.exist" });
    expect(toolEvents[2].result).toMatchObject({ ok: true, tool: "notify.send", mocked: false });
  });

  it("separates a policy denial from an execution failure", async () => {
    const store = createMemoryOpsStore();
    await store.upsertTool(projectId, { name: "files.search", side: "read", risk: "low", enabled: true });
    await store.putPolicy(projectId, defaultOpsPolicy(), "admin");
    const run = { id: "r2", projectId, killSwitch: false, cost: { toolCalls: 0, tokens: 0 } };
    const gateway = await createOpsToolGateway({
      store,
      projectId,
      run,
      definition: { steps: [{ id: "s", type: "tool_call", tool: "files.search" }] },
      policy: await store.getPolicy(projectId),
      execute: async () => ({ ok: false, error: "ai_search_unavailable" }),
    });
    const result = await gateway.call("files.search", { query: "x" }, { actor: "u1" });
    expect(result.ok).toBe(false);
    const events = (await store.listEvents(projectId, "r2")).filter((event) =>
      event.eventType.startsWith("ops.tool."),
    );
    expect(events.map((event) => event.eventType)).toEqual(["ops.tool.failed"]);
    expect(events[0].result).toMatchObject({ ok: false, tool: "files.search", error: "ai_search_unavailable" });
  });

  it("consumes an approval grant once (OPS-03)", async () => {
    const { store, gateway } = await seed();
    const input = { message: "hi" };
    const denied = await gateway.call("notify.send", input, { actor: "u1" });
    expect(denied.error).toBe("approval_required");
    const approval = await grant(store, input);
    expect(approval.payloadHash).toBe(await canonicalPayloadHash({ tool: "notify.send", input }));
    await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a1",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    await decideOpsApproval(store, {
      projectId,
      approvalId: approval.id,
      actor: "a2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });
    const used = await gateway.call("notify.send", input, { actor: "u1" });
    expect(used.ok).toBe(true);
    const replayed = await gateway.call("notify.send", input, { actor: "u1" });
    expect(replayed.error).toBe("approval_required");
    expect(replayed.payloadHash).toBe(approval.payloadHash);
  });

  async function seedMcpCall(catalog) {
    const store = createMemoryOpsStore();
    await store.upsertTool(projectId, {
      name: "mcp.call",
      side: "write",
      risk: "high",
      enabled: true,
      requiresApproval: true,
      dataClasses: ["message"],
    });
    await store.upsertMcpServer(projectId, {
      name: "grafana",
      url: "https://mcp.example.com/mcp",
      auth: "secret",
      enabled: true,
      allowedTools: catalog.map((entry) => entry.name),
      toolsCatalog: catalog,
    });
    await store.putPolicy(projectId, defaultOpsPolicy(), "admin");
    const run = { id: "rm", projectId, killSwitch: false, cost: { toolCalls: 0, tokens: 0 } };
    const gateway = await createOpsToolGateway({
      store,
      projectId,
      run,
      definition: { steps: [{ id: "m", type: "tool_call", tool: "mcp.call" }] },
      policy: await store.getPolicy(projectId),
      execute: async () => ({ ok: true, content: "dashboards" }),
    });
    return { store, gateway };
  }

  it("runs a pinned read-only mcp.call without the write approval", async () => {
    const { store, gateway } = await seedMcpCall([
      { name: "list_dashboards", readOnly: true, hash: "h1", approvedHash: "h1" },
    ]);

    const called = await gateway.call(
      "mcp.call",
      { server: "grafana", tool: "list_dashboards" },
      { actor: "u1" },
    );
    expect(called.ok).toBe(true);
    expect(called.readOnlyFastPath).toBe(true);
    const events = (await store.listEvents(projectId, "rm")).filter((event) =>
      event.eventType.startsWith("ops.tool."),
    );
    expect(events.map((event) => event.eventType)).toEqual(["ops.tool.called"]);
    expect(events[0].result).toMatchObject({ readOnlyFastPath: true });
  });

  it("keeps the write approval when the pinned definition drifted or the tool writes", async () => {
    const { store, gateway } = await seedMcpCall([
      { name: "restart_pod", readOnly: false, hash: "h2", approvedHash: "h2" },
    ]);

    const denied = await gateway.call("mcp.call", { server: "grafana", tool: "restart_pod" }, { actor: "u1" });
    expect(denied.error).toBe("approval_required");

    // A read-only hint whose definition changed after approval is still a stop.
    const row = await store.getMcpServerByName(projectId, "grafana");
    await store.upsertMcpServer(projectId, {
      ...row,
      allowedTools: ["list_dashboards"],
      toolsCatalog: [{ name: "list_dashboards", readOnly: true, hash: "h3", approvedHash: "h1" }],
    });
    const drifted = await gateway.call(
      "mcp.call",
      { server: "grafana", tool: "list_dashboards" },
      { actor: "u1" },
    );
    expect(drifted.error).toBe("approval_required");
  });

  it("denies a tool that exceeded its windowed quota, without counting denied calls (C5)", async () => {
    const store = createMemoryOpsStore();
    await store.upsertTool(projectId, { name: "files.search", side: "read", risk: "low", enabled: true });
    await store.putPolicy(projectId, { ...defaultOpsPolicy(), toolQuotas: [{ tool: "files.search", max: 3, windowMinutes: 60 }] }, "admin");
    const run = { id: "rq", projectId, killSwitch: false, cost: { toolCalls: 0, tokens: 0 } };
    let runs = 0;
    const gateway = await createOpsToolGateway({
      store,
      projectId,
      run,
      definition: { steps: [{ id: "s", type: "tool_call", tool: "files.search" }] },
      policy: await store.getPolicy(projectId),
      execute: async () => {
        runs += 1;
        return { ok: true, chunks: [] };
      },
    });
    for (let i = 0; i < 3; i++) {
      expect((await gateway.call("files.search", { query: "x" }, { actor: "u1" })).ok).toBe(true);
    }
    const over = await gateway.call("files.search", { query: "x" }, { actor: "u1" });
    expect(over).toMatchObject({ ok: false, error: "tool_quota_exceeded", limit: 3, windowMinutes: 60 });
    expect(runs).toBe(3);
    // The denial is audited like every other denial, and repeats don't extend it.
    const denied = (await store.listEvents(projectId, "rq")).filter((event) => event.eventType === "ops.tool.denied");
    expect(denied).toHaveLength(1);
    expect(denied[0].result).toMatchObject({ tool: "files.search", error: "tool_quota_exceeded" });
    expect(await gateway.call("files.search", { query: "x" }, { actor: "u1" })).toMatchObject({ error: "tool_quota_exceeded" });
  });

  it("enforces a tool ACL against the run initiator, before the allowlist (C7)", async () => {
    const store = createMemoryOpsStore();
    await store.upsertTool(projectId, { name: "files.search", side: "read", risk: "low", enabled: true });
    await store.upsertTool(projectId, { name: "notify.send", side: "write", risk: "medium", enabled: true, requiresApproval: true });
    await store.putPolicy(
      projectId,
      {
        ...defaultOpsPolicy(),
        toolAcls: [
          { tool: "files.search", allow: ["role:security", "user:u9"] },
          { tool: "notify.send", allow: ["role:security"] },
        ],
      },
      "admin",
    );
    const run = {
      id: "racl",
      projectId,
      trigger: { type: "manual", actor: "u1", roles: ["member"] },
      killSwitch: false,
      cost: { toolCalls: 0, tokens: 0 },
    };
    let runs = 0;
    const gateway = await createOpsToolGateway({
      store,
      projectId,
      run,
      definition: {
        steps: [
          { id: "r", type: "tool_call", tool: "files.search" },
          { id: "w", type: "tool_call", tool: "notify.send" },
        ],
      },
      policy: await store.getPolicy(projectId),
      execute: async () => {
        runs += 1;
        return { ok: true };
      },
    });

    const denied = await gateway.call("files.search", { query: "x" }, { actor: "u1" });
    expect(denied).toMatchObject({ ok: false, error: "tool_acl_denied", tool: "files.search" });
    expect(runs).toBe(0);
    const deniedEvents = (await store.listEvents(projectId, "racl")).filter((event) => event.eventType === "ops.tool.denied");
    expect(deniedEvents).toHaveLength(1);
    expect(deniedEvents[0].result).toMatchObject({ tool: "files.search", error: "tool_acl_denied" });

    // Mocked writes (builder dry-run) are forecast, not blocked.
    expect((await gateway.call("notify.send", { message: "hi" }, { actor: "u1", simulate: true })).ok).toBe(true);
    expect(runs).toBe(0);

    // Held by role: the ACL lets it through to the normal grant check.
    run.trigger = { type: "manual", actor: "u1", roles: ["security"] };
    expect((await gateway.call("files.search", { query: "x" }, { actor: "u2" })).ok).toBe(true);
    expect((await gateway.call("notify.send", { message: "hi" }, { actor: "u2" })).error).toBe("approval_required");
    expect(runs).toBe(1);

    // Held by explicit user id.
    run.trigger = { type: "manual", actor: "u9", roles: [] };
    expect((await gateway.call("files.search", { query: "x" }, { actor: "u9" })).ok).toBe(true);
    expect(runs).toBe(2);
  });
});
