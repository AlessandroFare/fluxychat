import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchOpsRoutes, getOpsStore } from "./ops-http.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";
import { startOpsRun } from "../lib/ops-engine.js";
import { defaultOpsPolicy, enableAllBuiltinTools } from "../lib/ops-policy.js";
import { checkAndConsumeRateLimit } from "../lib/rate-limit.js";
import { encryptSecret } from "../lib/secrets-crypto.js";

function h(store, opts = {}) {
  const { roles = ["admin"], userId = "u1", projectId = "p1", env = {} } = opts;
  return {
    env: { OPS_STORE: store, JWT_SECRET: "s", RATE_LIMIT_FALLBACK_ALLOW: "true", ...env },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    verifyJwtAndGetContext: async () => ({ projectId, userId, roles }),
    hasAnyRole: (roles2, allowed) => Array.isArray(roles2) && roles2.some((role) => allowed.includes(role)),
    checkAndConsumeRateLimit,
    logError: () => {},
    requestLogCtx: {},
  };
}

async function request(store, method, path, body, opts) {
  const res = await dispatchOpsRoutes(
    new Request(`https://x${path}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(body || {}) }),
    }),
    new URL(`https://x${path}`),
    h(store, opts),
  );
  return { res, data: await res.json() };
}

const post = (store, path, body, opts) => request(store, "POST", path, body, opts);
const get = (store, path, opts) => request(store, "GET", path, undefined, opts);
const patch = (store, path, body, opts) => request(store, "PATCH", path, body, opts);
const put = (store, path, body, opts) => request(store, "PUT", path, body, opts);

async function seedPublished(store, { projectId = "p1", slug = "pto" } = {}) {
  const def = await store.createDefinition({ projectId, slug, createdBy: "u1" });
  return store.saveVersion({
    projectId,
    definitionId: def.id,
    version: 1,
    status: "published",
    createdBy: "u1",
    publishedBy: "admin",
    definition: { slug, steps: [{ id: "end", type: "end" }] },
  });
}

describe("ops-http", () => {
  it("builds from chat and refuses builder publish", async () => {
    const store = createMemoryOpsStore();
    const chat = await post(store, "/ops/builder/sessions", {
      text: "When PTO is requested, manager approves and notify HR",
    });
    expect(chat.res.status).toBe(200);
    expect(chat.data.drafted.lint.ok).toBe(true);
    const forbidden = await post(store, "/ops/builder/tools", { name: "publish" });
    expect(forbidden.data.ok).toBe(false);
  });

  it("prefers an injected store over D1", () => {
    const store = createMemoryOpsStore();
    const env = {
      OPS_STORE: store,
      DB: {
        prepare() {
          throw new Error("d1_should_not_run");
        },
      },
    };
    expect(getOpsStore(env)).toBe(store);
  });

  it("kill closes open tasks and voids pending approvals", async () => {
    const store = createMemoryOpsStore();
    const def = await store.createDefinition({ projectId: "p1", slug: "kill-me", createdBy: "u1" });
    const version = await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      createdBy: "u1",
      publishedBy: "admin",
      definition: {
        slug: "kill-me",
        steps: [
          { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
          { id: "end", type: "end" },
        ],
      },
    });
    const run = await startOpsRun(store, { projectId: "p1", version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const approval = await store.getApproval("p1", run.context.approvalId);
    expect(await store.listOpenTasks("p1")).toHaveLength(1);

    const killed = await post(store, "/ops/kill", { runId: run.id });
    expect(killed.res.status).toBe(200);
    expect(killed.data.run.status).toBe("cancelled");
    expect(await store.listOpenTasks("p1")).toHaveLength(0);
    expect((await store.getApproval("p1", approval.id)).status).toBe("void");
  });

  it("serves the tool-call log, newest first", async () => {
    const store = createMemoryOpsStore();
    await store.appendEvent({ projectId: "p1", runId: "run_a", actor: "u1", eventType: "ops.tool.called", inputHash: "h1", result: { ok: true, tool: "files.search" }, createdAt: "2026-01-01T00:00:01.000Z" });
    await store.appendEvent({ projectId: "p1", runId: "run_a", actor: "u1", eventType: "ops.run.started", inputHash: "h2", result: {}, createdAt: "2026-01-01T00:00:02.000Z" });
    await store.appendEvent({ projectId: "p1", runId: "run_b", actor: "u2", eventType: "ops.tool.denied", inputHash: "h3", result: { ok: false, tool: "mcp.call", error: "budget_exceeded" }, createdAt: "2026-01-01T00:00:03.000Z" });

    const all = await get(store, "/ops/tool-calls");
    expect(all.data.items).toHaveLength(2);
    expect(all.data.items[0].eventType).toBe("ops.tool.denied");
    expect(all.data.items[0].runId).toBe("run_b");

    const scoped = await get(store, "/ops/tool-calls?runId=run_a");
    expect(scoped.data.items).toHaveLength(1);
    expect(scoped.data.items[0].eventType).toBe("ops.tool.called");
  });

  it("lists pending MRTR inputs and resumes the run when answered", async () => {
    const store = createMemoryOpsStore();
    for (const tool of enableAllBuiltinTools()) await store.upsertTool("p1", tool);
    await store.putPolicy("p1", defaultOpsPolicy(), "admin");
    const def = await store.createDefinition({ projectId: "p1", slug: "ask-env", createdBy: "u1" });
    const version = await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      createdBy: "u1",
      publishedBy: "admin",
      definition: {
        slug: "ask-env",
        steps: [
          { id: "read", type: "tool_call", tool: "db.query_named_view", input: { view: "orders" }, next: "end" },
          { id: "end", type: "end" },
        ],
      },
    });
    const calls = [];
    const run = await startOpsRun(store, {
      projectId: "p1",
      version,
      actor: "u1",
      roomId: "room-1",
      executeTool: async (name, input) => {
        calls.push({ name, input });
        if (calls.length === 1) {
          return {
            ok: false,
            error: "input_required",
            message: "Which environment?",
            requests: [{ id: "elicit-1", params: { message: "Which environment?" } }],
            requestState: "st-1",
          };
        }
        return { ok: true };
      },
    });
    expect(run.status).toBe("waiting");

    const listed = await get(store, "/ops/inputs", { roles: ["member"] });
    expect(listed.res.status).toBe(200);
    expect(listed.data.items).toHaveLength(1);
    expect(listed.data.items[0]).toMatchObject({
      runId: run.id,
      tool: "db.query_named_view",
      message: "Which environment?",
    });

    const missing = await post(store, "/ops/runs/run_missing/input", { responses: [{ id: "elicit-1", content: { env: "x" } }] });
    expect(missing.res.status).toBe(400);
    expect(missing.data.error).toBe("not_found");

    // The resume path runs the real tool: db.query_named_view is store-only.
    const answered = await post(store, `/ops/runs/${run.id}/input`, { responses: [{ id: "elicit-1", content: { env: "staging" } }] });
    expect(answered.res.status).toBe(200);
    expect(answered.data.ok).toBe(true);
    expect((await store.getRun("p1", run.id)).status).toBe("done");
    expect((await get(store, "/ops/inputs", { roles: ["member"] })).data.items).toHaveLength(0);

    const again = await post(store, `/ops/runs/${run.id}/input`, { responses: [{ id: "elicit-1", content: { env: "staging" } }] });
    expect(again.res.status).toBe(400);
    expect(again.data.error).toBe("run_not_waiting");
  });

  it("exports the project audit trail for admins only", async () => {
    const store = createMemoryOpsStore();
    await store.appendEvent({ projectId: "p1", runId: "run_a", actor: "u1", eventType: "ops.tool.called", inputHash: "h1", result: { ok: true } });

    const member = await get(store, "/ops/audit/export", { roles: ["member"] });
    expect(member.res.status).toBe(403);

    const admin = await get(store, "/ops/audit/export", { roles: ["admin"] });
    expect(admin.res.status).toBe(200);
    expect(admin.data.projectId).toBe("p1");
    expect(admin.data.events).toHaveLength(1);

    const res = await dispatchOpsRoutes(
      new Request("https://x/ops/audit/export?format=jsonl", { method: "GET" }),
      new URL("https://x/ops/audit/export?format=jsonl"),
      h(store),
    );
    expect(res.headers.get("content-type")).toContain("x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0].record).toBe("header");
  });

  it("serves the audit trail as JSONL", async () => {
    const store = createMemoryOpsStore();
    const version = await seedPublished(store);
    const run = await startOpsRun(store, { projectId: "p1", version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
    const path = `/ops/runs/${run.id}/audit?format=jsonl`;
    const res = await dispatchOpsRoutes(
      new Request(`https://x${path}`, { method: "GET" }),
      new URL(`https://x${path}`),
      h(store),
    );
    expect(res.headers.get("content-type")).toContain("x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ record: "run", runId: run.id, projectId: "p1" });
  });

  it("uses D1 when no store is injected", () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => null,
                all: async () => ({ results: [] }),
                run: async () => ({}),
              };
            },
          };
        },
      },
    };
    expect(getOpsStore(env).kind).toBe("d1");
  });

  it("lists runs after human publish", async () => {
    const store = createMemoryOpsStore();
    const chat = await post(store, "/ops/builder/sessions", {
      text: "When PTO is requested, manager approves and notify HR",
    });
    const versionId = chat.data.drafted.version.id;
    const req = await post(store, "/ops/builder/publish-request", { versionId });
    expect(req.data.approvalId).toBeTruthy();
    const decided = await post(store, `/ops/approvals/${req.data.approvalId}/decide`, {
      decision: "approve",
      payloadHash: versionId,
    });
    expect(decided.data.ok).toBe(true);
    const published = await post(store, "/ops/builder/publish", { approvalId: req.data.approvalId });
    expect(published.data.published.status).toBe("published");
    const started = await post(store, "/ops/runs", { versionId });
    expect(started.data.run.id).toBeTruthy();
    const listed = await get(store, "/ops/runs");
    expect(listed.data.runs.length).toBeGreaterThan(0);
    const patched = await patch(store, "/ops/tools", { name: "notify.send", enabled: false });
    expect(patched.data.tool.enabled).toBe(false);
    const invited = await post(store, "/ops/guests/invite", {
      runId: started.data.run.id,
      email: "auditor@partner.example",
      can: ["comment", "upload_file"],
    });
    expect(invited.data.token).toBeTruthy();
    expect(invited.data.can).toEqual(["comment", "upload_file"]);
    const redeemed = await post(store, "/ops/guest/redeem", {
      projectId: "p1",
      token: invited.data.token,
    });
    expect(redeemed.data.ok).toBe(true);
    // Audit F-88: the invite link cannot be redeemed twice.
    const reused = await post(store, "/ops/guest/redeem", {
      projectId: "p1",
      token: invited.data.token,
    });
    expect(reused.data.ok).toBe(false);
    expect(reused.data.error).toBe("invite_already_used");
    const sources = await get(store, "/ops/sources");
    expect(sources.data.namedViews.length).toBeGreaterThan(0);
    expect(sources.data.aiSearch).toBe(false);
  });

  it("denies guest-only tokens everywhere except their own invite action (OPS-01)", async () => {
    const store = createMemoryOpsStore();
    const guest = { roles: ["guest"], userId: "g1" };
    const runs = await get(store, "/ops/runs", guest);
    expect(runs.res.status).toBe(403);
    expect(runs.data.error).toBe("forbidden");
    const action = await post(store, "/ops/guests/action", { token: "bogus", action: "comment" }, guest);
    expect(action.res.status).toBe(403);
    expect(action.data.error).toBe("invalid_invite");
  });

  it("lets an invited guest approve their run's frozen payload, and only that (I7)", async () => {
    const store = createMemoryOpsStore();
    const def = await store.createDefinition({ projectId: "p1", slug: "guest-approval", createdBy: "u1" });
    const version = await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      createdBy: "u1",
      publishedBy: "admin",
      definition: {
        slug: "guest-approval",
        steps: [
          { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, next: "end" },
          { id: "end", type: "end" },
        ],
      },
    });
    const executeTool = async () => ({ ok: true });
    const run = await startOpsRun(store, { projectId: "p1", version, actor: "u1", roomId: "room-1", executeTool });
    const other = await startOpsRun(store, { projectId: "p1", version, actor: "u1", roomId: "room-2", executeTool });
    expect(run.status).toBe("waiting");

    const invited = await post(store, "/ops/guests/invite", {
      runId: run.id,
      email: "auditor@partner.example",
      can: ["approve"],
    });
    expect(invited.data.can).toEqual(["approve"]);
    const guest = { roles: ["guest"], userId: "g1" };
    const token = invited.data.token;

    // Another run's approval is out of reach, whatever the hash.
    const cross = await post(store, "/ops/guests/action", {
      token,
      action: "approve",
      approvalId: other.context.approvalId,
      payloadHash: other.context.payloadHash,
    }, guest);
    expect(cross.res.status).toBe(404);
    expect(cross.data.error).toBe("not_found");

    // The frozen-payload hash is required and checked before any decision.
    const wrongHash = await post(store, "/ops/guests/action", {
      token,
      action: "approve",
      approvalId: run.context.approvalId,
      payloadHash: "deadbeef",
    }, guest);
    expect(wrongHash.res.status).toBe(409);
    expect(wrongHash.data.error).toBe("payload_changed");
    expect((await store.getApproval("p1", run.context.approvalId)).status).toBe("pending");

    const approved = await post(store, "/ops/guests/action", {
      token,
      action: "approve",
      approvalId: run.context.approvalId,
      payloadHash: run.context.payloadHash,
    }, guest);
    expect(approved.res.status).toBe(200);
    expect(approved.data.approval.status).toBe("approved");
    expect((await store.getRun("p1", run.id)).status).toBe("done");
    const approval = await store.getApproval("p1", run.context.approvalId);
    expect(approval.decisions[0]).toMatchObject({ actor: "guest:auditor@partner.example", decision: "approve" });

    // A comment-only invite cannot approve.
    const commenter = await post(store, "/ops/guests/invite", {
      runId: other.id,
      email: "watcher@partner.example",
      can: ["comment"],
    });
    const denied = await post(store, "/ops/guests/action", {
      token: commenter.data.token,
      action: "approve",
      approvalId: other.context.approvalId,
      payloadHash: other.context.payloadHash,
    }, guest);
    expect(denied.res.status).toBe(403);
    expect(denied.data.error).toBe("scope_denied");
  });

  it("members read but cannot change policy or kill runs (OPS-01)", async () => {
    const store = createMemoryOpsStore();
    const member = { roles: ["member"], userId: "u2" };
    const listed = await get(store, "/ops/runs", member);
    expect(listed.res.status).toBe(200);
    const policy = await put(store, "/ops/policy", { policy: {} }, member);
    expect(policy.res.status).toBe(403);
    const kill = await post(store, "/ops/kill", { runId: "x" }, member);
    expect(kill.res.status).toBe(403);
    const tools = await patch(store, "/ops/tools", { name: "notify.send", enabled: true }, member);
    expect(tools.res.status).toBe(403);
    const invite = await post(store, "/ops/guests/invite", { runId: "x" }, member);
    expect(invite.res.status).toBe(403);
  });

  it("rejects tokens without a member role", async () => {
    const store = createMemoryOpsStore();
    const res = await get(store, "/ops/runs", { roles: [], userId: "u9" });
    expect(res.res.status).toBe(403);
  });

  it("webhook trigger requires auth, matching project and honors rate limit (OPS-02)", async () => {
    const store = createMemoryOpsStore();
    await seedPublished(store, { projectId: "wh" });
    const member = { roles: ["member"], userId: "u2", projectId: "wh" };
    const ok = await post(store, "/ops/triggers/webhook/wh/pto", { total: 1 }, member);
    expect(ok.res.status).toBe(200);
    expect(ok.data.run.id).toBeTruthy();
    const crossProject = await post(store, "/ops/triggers/webhook/other/pto", { total: 1 }, member);
    expect(crossProject.res.status).toBe(403);
    const guest = await post(store, "/ops/triggers/webhook/wh/pto", {}, { roles: ["guest"], userId: "g1", projectId: "wh" });
    expect(guest.res.status).toBe(403);

    const limited = { roles: ["member"], userId: "u2", projectId: "wh-limited", env: { RATE_LIMIT_OPS_WEBHOOK_PER_MINUTE: "1" } };
    await seedPublished(store, { projectId: "wh-limited" });
    const first = await post(store, "/ops/triggers/webhook/wh-limited/pto", {}, limited);
    expect(first.res.status).toBe(200);
    const second = await post(store, "/ops/triggers/webhook/wh-limited/pto", {}, limited);
    expect(second.res.status).toBe(429);
  });

  it("task completion follows assignee/role, not any member (OPS-04)", async () => {
    const store = createMemoryOpsStore();
    const def = await store.createDefinition({ projectId: "p1", slug: "hr", createdBy: "u1" });
    const version = await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      createdBy: "u1",
      publishedBy: "admin",
      definition: {
        slug: "hr",
        steps: [
          { id: "review", type: "human_task", assignee: { role: "owner" }, next: "end" },
          { id: "end", type: "end" },
        ],
      },
    });
    await startOpsRun(store, { projectId: "p1", version, actor: "u1", roomId: "room-x" });
    const tasks = await store.listOpenTasks("p1");
    const member = { roles: ["member"], userId: "u2" };
    const denied = await post(store, `/ops/tasks/${tasks[0].id}/complete`, {}, member);
    expect(denied.res.status).toBe(403);
    const admin = await post(store, `/ops/tasks/${tasks[0].id}/complete`, {}, { roles: ["admin"], userId: "u1" });
    expect(admin.res.status).toBe(200);
    expect(admin.data.ok).toBe(true);
  });

  it("shows role-addressed tasks to holders of the role in the inbox", async () => {
    const store = createMemoryOpsStore();
    await store.createTask({ projectId: "p1", runId: "run1", stepId: "approve-write", role: "owner", dueAt: null, status: "open" });
    await store.createTask({ projectId: "p1", runId: "run1", stepId: "personal", assignee: "u9", dueAt: null, status: "open" });

    const owner = await get(store, "/ops/inbox", { roles: ["member", "owner"], userId: "u9" });
    expect(owner.res.status).toBe(200);
    expect(owner.data.items.map((t) => t.stepId).sort()).toEqual(["approve-write", "personal"]);

    const plainMember = await get(store, "/ops/inbox", { roles: ["member"], userId: "u8" });
    expect(plainMember.data.items.map((t) => t.stepId)).toEqual([]);
  });

  it("installs the incident-response template and wires the policy (admin only)", async () => {
    const store = createMemoryOpsStore();
    const listed = await get(store, "/ops/templates");
    expect(listed.data.templates.some((t) => t.slug === "incident-response")).toBe(true);

    const member = { roles: ["member"], userId: "u2" };
    const denied = await post(store, "/ops/templates/incident-response/install", {}, member);
    expect(denied.res.status).toBe(403);

    const installed = await post(store, "/ops/templates/incident-response/install", {});
    expect(installed.data.ok).toBe(true);
    const published = await store.latestPublished("p1", "incident-response");
    expect(published?.status).toBe("published");
    const policy = await store.getPolicy("p1");
    expect(policy.incidentWorkflowSlug).toBe("incident-response");

    const missing = await post(store, "/ops/templates/nope/install", {});
    expect(missing.res.status).toBe(404);
  });

  it("executes the approved write when the run resumes (decide threading)", async () => {
    const store = createMemoryOpsStore();
    const def = await store.createDefinition({ projectId: "p1", slug: "notify-flow", createdBy: "u1" });
    await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      createdBy: "u1",
      publishedBy: "admin",
      definition: {
        slug: "notify-flow",
        steps: [
          { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, next: "notify" },
          { id: "notify", type: "tool_call", tool: "notify.send", input: { message: "hello" }, next: "end" },
          { id: "end", type: "end" },
        ],
      },
    });
    const inserts = [];
    const d1 = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                first: async () => null,
                run: async () => {
                  inserts.push(sql);
                  return { meta: { changes: 1, last_row_id: inserts.length } };
                },
                all: async () => ({ results: sql.includes("room_members") ? [{ user_id: "u2" }] : [] }),
              };
            },
          };
        },
      },
    };

    const started = await post(store, "/ops/runs", { slug: "notify-flow" }, { env: d1 });
    expect(started.data.run.status).toBe("waiting");
    const approvalId = started.data.run.context.approvalId;
    const approval = await store.getApproval("p1", approvalId);

    const decided = await post(
      store,
      `/ops/approvals/${approvalId}/decide`,
      { decision: "approve", payloadHash: approval.payloadHash },
      { env: d1 },
    );
    expect(decided.res.status).toBe(200);
    expect(inserts.some((sql) => sql.includes("in_app_notifications"))).toBe(true);
    const finished = await store.getRun("p1", started.data.run.id);
    expect(finished.status).toBe("done");
  });
});

describe("ops-http mcp-servers", () => {
  const envOpts = {
    env: { WEBHOOK_SECRET_ENCRYPTION_KEY: btoa("0123456789abcdef0123456789abcdef"), ALLOWED_SSRF_HOSTS: "mcp.example.com" },
  };

  function mcpStub({ tools = [{ name: "query" }], callText = null } = {}) {
    const json = (body) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    return vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "mock" } } });
      if (callText !== null && body.method === "tools/call") {
        return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: callText }] } });
      }
      return json({ jsonrpc: "2.0", id: body.id, result: { tools } });
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers, lists (redacted), refreshes and deletes an MCP server", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", mcpStub());

    const created = await post(
      store,
      "/ops/mcp-servers",
      { name: "grafana", url: "https://mcp.example.com/mcp", secret: "tok-123", allowedTools: ["query"] },
      envOpts,
    );
    expect(created.res.status).toBe(200);
    expect(created.data.server.hasSecret).toBe(true);
    expect(created.data.server.secretCiphertext).toBeUndefined();
    expect(created.data.discovery.tools).toEqual(["query"]);

    const listed = await get(store, "/ops/mcp-servers", envOpts);
    expect(listed.data.servers).toHaveLength(1);
    expect(listed.data.servers[0].name).toBe("grafana");
    expect(JSON.stringify(listed.data)).not.toContain("tok-123");
    expect(JSON.stringify(listed.data)).not.toContain("ciphertext");

    const id = created.data.server.id;
    const refreshed = await post(store, `/ops/mcp-servers/${id}/refresh`, {}, envOpts);
    expect(refreshed.res.status).toBe(200);
    expect(refreshed.data.server.discoveredTools).toEqual(["query"]);

    const removed = await request(store, "DELETE", `/ops/mcp-servers/${id}`, undefined, envOpts);
    expect(removed.res.status).toBe(200);
    expect((await get(store, "/ops/mcp-servers", envOpts)).data.servers).toHaveLength(0);
    expect((await request(store, "DELETE", `/ops/mcp-servers/${id}`, undefined, envOpts)).res.status).toBe(404);
  });

  it("requires admin to change the registry; members can read it", async () => {
    const store = createMemoryOpsStore();
    const member = { roles: ["member"] };
    expect((await post(store, "/ops/mcp-servers", { name: "x", url: "https://mcp.example.com" }, member)).res.status).toBe(403);
    expect((await post(store, "/ops/mcp-servers/omcp_1/refresh", {}, member)).res.status).toBe(403);
    expect((await request(store, "DELETE", "/ops/mcp-servers/omcp_1", undefined, member)).res.status).toBe(403);
    const listed = await get(store, "/ops/mcp-servers", member);
    expect(listed.res.status).toBe(200);
    expect(listed.data.servers).toEqual([]);
  });

  it("rejects an invalid url", async () => {
    const store = createMemoryOpsStore();
    const bad = await post(store, "/ops/mcp-servers", { name: "x", url: "not-a-url" }, envOpts);
    expect(bad.res.status).toBe(400);
    expect(bad.data.error).toBe("invalid_url");
  });

  it("tries a pinned read-only tool and refuses writes", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal(
      "fetch",
      mcpStub({
        tools: [{ name: "query", annotations: { readOnlyHint: true } }, { name: "restart" }],
        callText: "42 pods",
      }),
    );
    const created = await post(
      store,
      "/ops/mcp-servers",
      { name: "grafana", url: "https://mcp.example.com/mcp", secret: "tok-123", allowedTools: ["query", "restart"] },
      envOpts,
    );
    const id = created.data.server.id;

    expect((await post(store, `/ops/mcp-servers/${id}/tools/restart/try`, { arguments: {} }, envOpts)).res.status).toBe(400);
    const write = await post(store, `/ops/mcp-servers/${id}/tools/restart/try`, { arguments: {} }, envOpts);
    expect(write.data.error).toBe("try_requires_read_only");

    expect((await post(store, `/ops/mcp-servers/${id}/tools/query/try`, {}, { roles: ["member"] })).res.status).toBe(403);

    const ok = await post(store, `/ops/mcp-servers/${id}/tools/query/try`, { arguments: { q: "pods" } }, envOpts);
    expect(ok.res.status).toBe(200);
    expect(ok.data.ok).toBe(true);
    expect(ok.data.server).toBe("grafana");
    expect(ok.data.tool).toBe("query");
    expect(ok.data.content).toBe("42 pods");
  });

  it("lets a member connect an OAuth server and manage only their own connection", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", mcpStub());
    const oauthInput = {
      name: "oauth-srv",
      url: "https://mcp.example.com/mcp",
      auth: "oauth",
      oauthAuthorizeUrl: "https://auth.example.com/authorize",
      oauthTokenUrl: "https://auth.example.com/token",
      oauthClientId: "client-1",
    };
    const created = await post(store, "/ops/mcp-servers", oauthInput, envOpts);
    expect(created.res.status).toBe(200);
    expect(created.data.server.auth).toBe("oauth");
    const serverId = created.data.server.id;
    const member = { roles: ["member"], userId: "u1", env: envOpts.env };

    const connect = await post(store, `/ops/mcp-servers/${serverId}/connect`, {}, member);
    expect(connect.res.status).toBe(200);
    expect(connect.data.authorizationUrl).toContain("https://auth.example.com/authorize?");
    expect(connect.data.authorizationUrl).toContain("code_challenge_method=S256");

    const encrypted = await encryptSecret(envOpts.env, "at-route");
    await store.upsertMcpConnection("p1", {
      serverId,
      userId: "u1",
      accessCiphertext: encrypted.ciphertext,
      accessIv: encrypted.iv,
      tokenUrl: "https://auth.example.com/token",
      clientId: "client-1",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "active",
    });

    const own = await get(store, "/ops/mcp-connections", member);
    expect(own.data.items).toHaveLength(1);
    expect(own.data.items[0]).toMatchObject({ serverId, serverName: "oauth-srv", status: "active" });
    expect(JSON.stringify(own.data)).not.toContain("ciphertext");
    expect((await get(store, "/ops/mcp-connections", { roles: ["member"], userId: "u2", env: envOpts.env })).data.items).toEqual([]);

    // Someone else's connection is invisible and undeletable for a member.
    const foreign = await request(store, "DELETE", `/ops/mcp-connections/${own.data.items[0].id}`, undefined, {
      roles: ["member"],
      userId: "u2",
      env: envOpts.env,
    });
    expect(foreign.res.status).toBe(404);

    // An admin can disconnect any connection in the project.
    const adminDelete = await request(store, "DELETE", `/ops/mcp-connections/${own.data.items[0].id}`, undefined, {
      roles: ["admin"],
      userId: "admin-1",
      env: envOpts.env,
    });
    expect(adminDelete.res.status).toBe(200);
    expect((await get(store, "/ops/mcp-connections", member)).data.items).toEqual([]);

    const bearer = await post(store, "/ops/mcp-servers", { name: "bearer", url: "https://mcp.example.com/mcp" }, envOpts);
    const wrongMode = await post(store, `/ops/mcp-servers/${bearer.data.server.id}/connect`, {}, member);
    expect(wrongMode.res.status).toBe(400);
    expect(wrongMode.data.error).toBe("oauth_not_enabled");
  });
});
