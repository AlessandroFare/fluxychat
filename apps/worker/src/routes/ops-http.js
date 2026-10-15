import { pickRouteDeps } from "./route-http-deps.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";
import { createD1OpsStore } from "../lib/ops-store-d1.js";
import { catalogNamedViews, enableAllBuiltinTools, mergeProjectTools, normalizeOpsPolicy } from "../lib/ops-policy.js";
import { handleBuilderChat, invokeBuilderTool } from "../lib/ops-builder.js";
import { completeOpsTask, decideRunApproval, startOpsRun } from "../lib/ops-engine.js";
import { decideOpsApproval } from "../lib/ops-gateway.js";
import { executeOpsTool, ingestOpsFile, deleteOpsFile, searchOpsFiles, describeOpsSources } from "../lib/ops-sources.js";
import { issueOpsGuestInvite, redeemOpsGuestInvite, guestMay } from "../lib/ops-guest.js";
import { exportOpsAudit, opsAuditPdf } from "../lib/ops-audit.js";
import { lintOpsDefinition } from "../lib/ops-lint.js";

const STORES = new Map();

export function getOpsStore(env) {
  if (env?.OPS_STORE) return env.OPS_STORE;
  if (env?.DB?.prepare) {
    env.OPS_STORE = createD1OpsStore(env);
    return env.OPS_STORE;
  }
  const key = env?.OPS_STORE_KEY || "default";
  if (!STORES.has(key)) STORES.set(key, createMemoryOpsStore());
  if (env && !env.OPS_STORE) env.OPS_STORE = STORES.get(key);
  return STORES.get(key);
}

async function ensureCatalog(store, projectId) {
  const existing = await store.listTools(projectId);
  if (!existing.length) {
    for (const tool of enableAllBuiltinTools()) await store.upsertTool(projectId, tool);
  }
  if (!(await store.getPolicy(projectId))) {
    await store.putPolicy(projectId, normalizeOpsPolicy(null), "system");
  }
}

function jsonRead(request) {
  return request.json().catch(() => ({}));
}

export async function dispatchOpsRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/ops")) return null;
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "verifyJwtAndGetContext", "logError", "requestLogCtx"]);

  const store = getOpsStore(env);

  const guestMatch = path.match(/^\/ops\/guest\/redeem$/);
  if (guestMatch && request.method === "POST") {
    const body = await jsonRead(request);
    const redeemed = await redeemOpsGuestInvite(store, {
      projectId: body.projectId,
      token: body.token,
      secret: env?.JWT_SECRET,
    });
    return json(redeemed, { status: redeemed.ok ? 200 : 403, headers: corsHeaders });
  }

  const hook = path.match(/^\/ops\/triggers\/webhook\/([^/]+)\/([^/]+)$/);
  if (hook && request.method === "POST") {
    const projectId = decodeURIComponent(hook[1]);
    const slug = decodeURIComponent(hook[2]);
    await ensureCatalog(store, projectId);
    const published = await store.latestPublished(projectId, slug);
    if (!published) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    const body = await jsonRead(request);
    const policy = normalizeOpsPolicy(await store.getPolicy(projectId));
    const run = await startOpsRun(store, {
      env,
      projectId,
      version: published,
      trigger: { type: "webhook" },
      context: body,
      actor: "webhook",
      roomId: `opsrun_${crypto.randomUUID().slice(0, 10)}`,
      executeTool: (name, input, extra) => executeOpsTool(store, policy, env, name, input, { ...extra, projectId }),
    });
    return json({ run }, { headers: corsHeaders });
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("ops.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const projectId = auth.projectId;
  await ensureCatalog(store, projectId);
  const tools = mergeProjectTools(await store.listTools(projectId));
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));

  if (path === "/ops/builder/sessions" && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await handleBuilderChat(store, {
      projectId,
      actor: auth.userId,
      text: body.text || body.message || "",
      sessionId: body.sessionId,
    });
    return json(result, { headers: corsHeaders });
  }

  if (path === "/ops/builder/tools" && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await invokeBuilderTool(store, {
      projectId,
      actor: auth.userId,
      name: body.name,
      input: body.input || {},
    });
    return json(result, { headers: corsHeaders });
  }

  const draftPatch = path.match(/^\/ops\/builder\/drafts\/([^/]+)$/);
  if (draftPatch && request.method === "PATCH") {
    const version = await store.getVersion(projectId, draftPatch[1]);
    if (!version) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    const body = await jsonRead(request);
    const next = await store.saveVersion({
      projectId,
      definitionId: version.definitionId,
      version: await store.nextVersionNumber(projectId, version.definitionId),
      status: "draft",
      definition: body.definition || version.definition,
      createdBy: auth.userId,
    });
    return json({ version: next, lint: lintOpsDefinition(next.definition, { tools, policy }) }, { headers: corsHeaders });
  }

  if (path === "/ops/builder/validate" && request.method === "POST") {
    const body = await jsonRead(request);
    return json({ lint: lintOpsDefinition(body.definition, { tools, policy }) }, { headers: corsHeaders });
  }

  if (path === "/ops/builder/simulate" && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await invokeBuilderTool(store, {
      projectId,
      actor: auth.userId,
      name: "simulate_run",
      input: body,
    });
    return json(result, { headers: corsHeaders });
  }

  if (path === "/ops/builder/publish-request" && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await invokeBuilderTool(store, {
      projectId,
      actor: auth.userId,
      name: "request_publish",
      input: body,
    });
    return json(result, { headers: corsHeaders });
  }

  if (path === "/ops/builder/publish" && request.method === "POST") {
    const body = await jsonRead(request);
    const approval = await store.getApproval(projectId, body.approvalId);
    if (!approval || approval.status === "pending") {
      return json({ error: "publish_requires_human_approval" }, { status: 403, headers: corsHeaders });
    }
    if (approval.status !== "approved") return json({ error: "not_approved" }, { status: 403, headers: corsHeaders });
    const published = await store.publishVersion(projectId, approval.payload.versionId, auth.userId);
    return json({ published }, { headers: corsHeaders });
  }

  if (path === "/ops/runs" && request.method === "POST") {
    const body = await jsonRead(request);
    const published = body.versionId
      ? await store.getVersion(projectId, body.versionId)
      : await store.latestPublished(projectId, body.slug);
    if (!published || published.status !== "published") {
      return json({ error: "not_published" }, { status: 400, headers: corsHeaders });
    }
    const roomId = `opsrun_${crypto.randomUUID().slice(0, 10)}`;
    if (env?.DB?.prepare) {
      await env.DB.prepare(
        "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'group', ?, ?)",
      )
        .bind(roomId, projectId, `Run ${published.definition?.title || published.id}`, new Date().toISOString())
        .run()
        .catch(() => {});
    }
    const run = await startOpsRun(store, {
      env,
      projectId,
      version: published,
      trigger: body.trigger || { type: "manual" },
      context: body.context || {},
      actor: auth.userId,
      roomId,
      executeTool: (name, input, extra) => executeOpsTool(store, policy, env, name, input, { ...extra, projectId }),
    });
    return json({ run }, { headers: corsHeaders });
  }

  if (path === "/ops/runs" && request.method === "GET") {
    const runs = await store.listRuns(projectId, { status: url.searchParams.get("status") || undefined });
    return json({ runs }, { headers: corsHeaders });
  }

  if (path === "/ops/policy" && request.method === "GET") {
    return json({ policy, namedViews: catalogNamedViews(policy) }, { headers: corsHeaders });
  }

  if (path === "/ops/policy" && request.method === "PUT") {
    const body = await jsonRead(request);
    const saved = await store.putPolicy(projectId, normalizeOpsPolicy({ ...policy, ...body.policy }), auth.userId);
    return json({ policy: saved.policy, namedViews: catalogNamedViews(saved.policy) }, { headers: corsHeaders });
  }

  if (path === "/ops/tools" && request.method === "PATCH") {
    const body = await jsonRead(request);
    const current = tools.find((t) => t.name === body.name);
    if (!current) return json({ error: "unknown_tool" }, { status: 400, headers: corsHeaders });
    const updated = await store.upsertTool(projectId, { ...current, enabled: body.enabled !== false, requiresApproval: body.requiresApproval ?? current.requiresApproval });
    return json({ tool: updated }, { headers: corsHeaders });
  }

  const runGet = path.match(/^\/ops\/runs\/([^/]+)$/);
  if (runGet && request.method === "GET") {
    const run = await store.getRun(projectId, runGet[1]);
    if (!run) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    return json({ run, steps: await store.listSteps(projectId, run.id) }, { headers: corsHeaders });
  }

  if (path === "/ops/inbox" && request.method === "GET") {
    const items = await store.listOpenTasks(projectId, { assignee: auth.userId });
    return json({ items }, { headers: corsHeaders });
  }

  if (path === "/ops/approvals" && request.method === "GET") {
    const items = await store.listPendingApprovals(projectId);
    return json({ items }, { headers: corsHeaders });
  }

  const decide = path.match(/^\/ops\/approvals\/([^/]+)\/decide$/);
  if (decide && request.method === "POST") {
    const body = await jsonRead(request);
    const existing = await store.getApproval(projectId, decide[1]);
    if (!existing) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    const args = {
      env,
      projectId,
      approvalId: decide[1],
      actor: auth.userId,
      decision: body.decision,
      payloadHash: body.payloadHash,
    };
    const isPublish = existing.stepId === "publish" || !(await store.getRun(projectId, existing.runId));
    const result = isPublish ? await decideOpsApproval(store, args) : await decideRunApproval(store, args);
    if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  const taskDone = path.match(/^\/ops\/tasks\/([^/]+)\/complete$/);
  if (taskDone && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await completeOpsTask(store, {
      env,
      projectId,
      taskId: taskDone[1],
      actor: auth.userId,
      contextPatch: body.context,
    });
    return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  }

  if (path === "/ops/files" && request.method === "POST") {
    const body = await jsonRead(request);
    const file = await ingestOpsFile(env, store, {
      projectId,
      sourceId: body.sourceId || "files",
      key: body.key || "upload",
      text: body.text || "",
      contentType: body.contentType,
    });
    return json({ file }, { headers: corsHeaders });
  }

  if (path === "/ops/files/search" && request.method === "POST") {
    const body = await jsonRead(request);
    const results = await searchOpsFiles(env, store, { projectId, query: body.query });
    return json(results, { headers: corsHeaders });
  }

  const fileDel = path.match(/^\/ops\/files\/([^/]+)$/);
  if (fileDel && request.method === "DELETE") {
    const result = await deleteOpsFile(env, store, { projectId, fileId: fileDel[1] });
    return json(result, { headers: corsHeaders });
  }

  if (path === "/ops/tools" && request.method === "GET") {
    return json({ tools }, { headers: corsHeaders });
  }

  if (path === "/ops/sources" && request.method === "GET") {
    return json(describeOpsSources(env, policy), { headers: corsHeaders });
  }

  if (path === "/ops/kill" && request.method === "POST") {
    const body = await jsonRead(request);
    const run = await store.getRun(projectId, body.runId);
    if (!run) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    run.killSwitch = true;
    run.status = "cancelled";
    await store.saveRun(run);
    return json({ run }, { headers: corsHeaders });
  }

  const audit = path.match(/^\/ops\/runs\/([^/]+)\/audit$/);
  if (audit && request.method === "GET") {
    const exported = await exportOpsAudit(store, { projectId, runId: audit[1] });
    if (!exported.ok) return json(exported, { status: 404, headers: corsHeaders });
    if (url.searchParams.get("format") === "pdf") {
      return new Response(opsAuditPdf(exported.json), {
        headers: { "Content-Type": "application/pdf", ...corsHeaders },
      });
    }
    return json(exported.json, { headers: corsHeaders });
  }

  if (path === "/ops/guests/invite" && request.method === "POST") {
    const body = await jsonRead(request);
    const issued = await issueOpsGuestInvite(store, {
      projectId,
      runId: body.runId,
      email: body.email,
      can: body.can,
      secret: env?.JWT_SECRET,
    });
    return json(issued, { headers: corsHeaders });
  }

  if (path === "/ops/guests/action" && request.method === "POST") {
    const body = await jsonRead(request);
    const redeemed = await redeemOpsGuestInvite(store, {
      projectId,
      token: body.token,
      secret: env?.JWT_SECRET,
    });
    if (!redeemed.ok) return json(redeemed, { status: 403, headers: corsHeaders });
    if (!guestMay(redeemed.guest, body.action)) {
      return json({ error: "scope_denied" }, { status: 403, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
}
