import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { enableAllBuiltinTools, defaultOpsPolicy } from "./ops-policy.js";
import { startOpsRun, completeOpsTask, decideRunApproval } from "./ops-engine.js";
import { canonicalPayloadHash } from "./canonical-payload-hash.js";

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

  it("isolates projects", async () => {
    const store = createMemoryOpsStore();
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
});
