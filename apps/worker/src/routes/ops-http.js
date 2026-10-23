import { pickRouteDeps } from "./route-http-deps.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";
import { createD1OpsStore } from "../lib/ops-store-d1.js";
import { catalogNamedViews, enableAllBuiltinTools, mergeProjectTools, normalizeOpsPolicy } from "../lib/ops-policy.js";
import { handleBuilderChat, invokeBuilderTool } from "../lib/ops-builder.js";
import { answerOpsInput, closeOpsRunWork, completeOpsTask, decideRunApproval, listPendingInputs, startOpsRun } from "../lib/ops-engine.js";
import { decideOpsApproval } from "../lib/ops-gateway.js";
import { executeOpsTool, ingestOpsFile, deleteOpsFile, searchOpsFiles, describeOpsSources } from "../lib/ops-sources.js";
import { issueOpsGuestInvite, redeemOpsGuestInvite, guestMay } from "../lib/ops-guest.js";
import { exportOpsAudit, exportOpsEvidence, opsAuditJsonl, opsAuditPdf, opsEvidenceJsonl, buildOpsRunReceipt, buildOpsEvidenceReceipt } from "../lib/ops-audit.js";
import { computeOversight } from "../lib/ops-oversight.js";
import { lintOpsDefinition } from "../lib/ops-lint.js";
import { installOpsTemplate, listOpsTemplates } from "../lib/ops-templates.js";
import { isGuestOnlyAuth } from "../lib/guest-auth.js";
import { redactMcpServer, registerMcpServer, refreshMcpTools, reapproveMcpTool, removeMcpServer, tryMcpTool } from "../lib/ops-mcp.js";
import { listMcpConnectionsForUser, publicOrigin, redactMcpConnection, startMcpConnect } from "../lib/ops-mcp-oauth.js";

const STORES = new Map();

/** OPS-01: member-plus roles for the /ops surface (mirrors guest-auth MEMBER_PLUS_ROLES). */
const OPS_MEMBER_ROLES = ["member", "owner", "admin", "mod", "moderator", "bot"];
const OPS_ADMIN_ROLES = ["owner", "admin"];
/** Upload cap for inline text files (OPS-06). */
const OPS_MAX_FILE_TEXT_CHARS = 5_000_000;

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
    hasAnyRole,
    checkAndConsumeRateLimit,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "checkAndConsumeRateLimit",
    "logError",
    "requestLogCtx",
  ]);

  const store = getOpsStore(env);

  const guestMatch = path.match(/^\/ops\/guest\/redeem$/);
  if (guestMatch && request.method === "POST") {
    const body = await jsonRead(request);
    const redeemed = await redeemOpsGuestInvite(store, {
      projectId: body.projectId,
      token: body.token,
      secret: env?.JWT_SECRET,
      // Audit F-88: the invite link is single-use.
      consume: true,
    });
    return json(redeemed, { status: redeemed.ok ? 200 : 403, headers: corsHeaders });
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("ops.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const projectId = auth.projectId;

  // OPS-01: /ops is a member/admin surface. Guest-only tokens may only act on
  // their own invite (POST /ops/guests/action); tokens without a member role
  // are denied outright.
  const guestOnly = isGuestOnlyAuth(auth);
  const guestSelfAction = path === "/ops/guests/action" && request.method === "POST";
  const isAdmin = hasAnyRole(auth.roles, OPS_ADMIN_ROLES);
  const forbidden = () => json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  if ((guestOnly && !guestSelfAction) || (!guestOnly && !hasAnyRole(auth.roles, OPS_MEMBER_ROLES))) {
    return forbidden();
  }

  await ensureCatalog(store, projectId);
  const tools = mergeProjectTools(await store.listTools(projectId));
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));

  // One closure for real tool execution, shared by run start AND resume
  // (approval/task completion). The engine's resume path must receive it too,
  // otherwise an approved write would silently execute as a no-op.
  const opsExecuteTool = (name, input, extra) =>
    executeOpsTool(store, policy, env, name, input, { ...extra, projectId });

  // OPS-02: webhook triggers require a member+ project token, must target the
  // token's own project, and are rate limited. Previously anonymous, which
  // allowed starting runs (and reading their results) for any projectId.
  const hook = path.match(/^\/ops\/triggers\/webhook\/([^/]+)\/([^/]+)$/);
  if (hook && request.method === "POST") {
    if (decodeURIComponent(hook[1]) !== projectId) return forbidden();
    const rate = await checkAndConsumeRateLimit(env, {
      key: `ops:webhook:${projectId}`,
      limit: Number(env.RATE_LIMIT_OPS_WEBHOOK_PER_MINUTE || 30),
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return json(
        { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const slug = decodeURIComponent(hook[2]);
    const published = await store.latestPublished(projectId, slug);
    if (!published) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    const body = await jsonRead(request);
    const run = await startOpsRun(store, {
      env,
      projectId,
      version: published,
      trigger: { type: "webhook" },
      context: body,
      actor: auth.userId,
      actorRoles: auth.roles,
      roomId: `opsrun_${crypto.randomUUID().slice(0, 10)}`,
      executeTool: opsExecuteTool,
    });
    return json({ run }, { headers: corsHeaders });
  }

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
    if (!isAdmin) return forbidden();
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
      actorRoles: auth.roles,
      roomId,
      executeTool: opsExecuteTool,
    });
    return json({ run }, { headers: corsHeaders });
  }

  if (path === "/ops/runs" && request.method === "GET") {
    const runs = await store.listRuns(projectId, { status: url.searchParams.get("status") || undefined });
    return json({ runs }, { headers: corsHeaders });
  }

  if (path === "/ops/tool-calls" && request.method === "GET") {
    const items = await store.listToolEvents(projectId, {
      runId: url.searchParams.get("runId") || null,
      limit: Number(url.searchParams.get("limit")) || 100,
    });
    return json({ items }, { headers: corsHeaders });
  }

  if (path === "/ops/policy" && request.method === "GET") {
    return json({ policy, namedViews: catalogNamedViews(policy) }, { headers: corsHeaders });
  }

  if (path === "/ops/policy" && request.method === "PUT") {
    if (!isAdmin) return forbidden();
    const body = await jsonRead(request);
    const saved = await store.putPolicy(projectId, normalizeOpsPolicy({ ...policy, ...body.policy }), auth.userId);
    return json({ policy: saved.policy, namedViews: catalogNamedViews(saved.policy) }, { headers: corsHeaders });
  }

  if (path === "/ops/templates" && request.method === "GET") {
    return json({ templates: listOpsTemplates() }, { headers: corsHeaders });
  }

  const installTemplate = path.match(/^\/ops\/templates\/([^/]+)\/install$/);
  if (installTemplate && request.method === "POST") {
    if (!isAdmin) return forbidden();
    const result = await installOpsTemplate(store, {
      projectId,
      slug: decodeURIComponent(installTemplate[1]),
      actor: auth.userId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (path === "/ops/tools" && request.method === "PATCH") {
    if (!isAdmin) return forbidden();
    const body = await jsonRead(request);
    const current = tools.find((t) => t.name === body.name);
    if (!current) return json({ error: "unknown_tool" }, { status: 400, headers: corsHeaders });
    const updated = await store.upsertTool(projectId, { ...current, enabled: body.enabled !== false, requiresApproval: body.requiresApproval ?? current.requiresApproval });
    return json({ tool: updated }, { headers: corsHeaders });
  }

  // Ops MCP gateway: operator-managed external MCP servers. Reading the
  // (redacted) registry is member+, changing it is admin.
  if (path === "/ops/mcp-servers" && request.method === "GET") {
    const servers = await store.listMcpServers(projectId);
    return json({ servers: servers.map(redactMcpServer) }, { headers: corsHeaders });
  }

  if (path === "/ops/mcp-servers" && request.method === "POST") {
    if (!isAdmin) return forbidden();
    const body = await jsonRead(request);
    const result = await registerMcpServer(store, env, { projectId, input: body, createdBy: auth.userId });
    return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  }

  const mcpRefresh = path.match(/^\/ops\/mcp-servers\/([^/]+)\/refresh$/);
  if (mcpRefresh && request.method === "POST") {
    if (!isAdmin) return forbidden();
    const result = await refreshMcpTools(store, env, { projectId, id: mcpRefresh[1], userId: auth.userId });
    return json(result, { status: result.ok ? 200 : 404, headers: corsHeaders });
  }

  // Re-pin one tool after a definition change; calls stay blocked until this
  // admin decision is recorded.
  const mcpReapprove = path.match(/^\/ops\/mcp-servers\/([^/]+)\/tools\/([^/]+)\/reapprove$/);
  if (mcpReapprove && request.method === "POST") {
    if (!isAdmin) return forbidden();
    let tool = mcpReapprove[2];
    try {
      tool = decodeURIComponent(tool);
    } catch {
      /* keep the raw segment */
    }
    const result = await reapproveMcpTool(store, { projectId, id: mcpReapprove[1], tool, actor: auth.userId });
    return json(result, { status: result.ok ? 200 : 404, headers: corsHeaders });
  }

  // "Try tool" from the settings card: read-only pinned tools only, so the
  // button can never trigger a write outside the run approval flow.
  const mcpTry = path.match(/^\/ops\/mcp-servers\/([^/]+)\/tools\/([^/]+)\/try$/);
  if (mcpTry && request.method === "POST") {
    if (!isAdmin) return forbidden();
    let tool = mcpTry[2];
    try {
      tool = decodeURIComponent(tool);
    } catch {
      /* keep the raw segment */
    }
    const body = await jsonRead(request);
    const result = await tryMcpTool(store, env, {
      projectId,
      id: mcpTry[1],
      tool,
      args: body?.arguments,
      actor: auth.userId,
    });
    return json(result, {
      status: result.ok ? 200 : result.error === "not_found" ? 404 : 400,
      headers: corsHeaders,
    });
  }

  const mcpConnect = path.match(/^\/ops\/mcp-servers\/([^/]+)\/connect$/);
  if (mcpConnect && request.method === "POST") {
    // Any member connects their own account; the state binds it to auth.userId.
    const result = await startMcpConnect(store, env, {
      projectId,
      serverId: mcpConnect[1],
      userId: auth.userId,
      origin: publicOrigin(env, url),
    });
    return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  }

  // Per-user OAuth connections: members see and disconnect their own; an admin
  // can disconnect any connection in the project.
  if (path === "/ops/mcp-connections" && request.method === "GET") {
    const items = await listMcpConnectionsForUser(store, projectId, auth.userId);
    return json({ items }, { headers: corsHeaders });
  }

  const mcpConnectionDelete = path.match(/^\/ops\/mcp-connections\/([^/]+)$/);
  if (mcpConnectionDelete && request.method === "DELETE") {
    const scope = isAdmin ? {} : { userId: auth.userId };
    const own = (await store.listMcpConnections(projectId, scope)).find(
      (connection) => connection.id === mcpConnectionDelete[1],
    );
    if (!own) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    await store.deleteMcpConnection(projectId, own.id);
    return json({ ok: true, connection: redactMcpConnection(own) }, { headers: corsHeaders });
  }

  const mcpDelete = path.match(/^\/ops\/mcp-servers\/([^/]+)$/);
  if (mcpDelete && request.method === "DELETE") {
    if (!isAdmin) return forbidden();
    const result = await removeMcpServer(store, projectId, mcpDelete[1]);
    return json(result, { status: result.ok ? 200 : 404, headers: corsHeaders });
  }

  const runGet = path.match(/^\/ops\/runs\/([^/]+)$/);
  if (runGet && request.method === "GET") {
    const run = await store.getRun(projectId, runGet[1]);
    if (!run) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    return json({ run, steps: await store.listSteps(projectId, run.id) }, { headers: corsHeaders });
  }

  if (path === "/ops/inbox" && request.method === "GET") {
    const items = await store.listOpenTasks(projectId, { assignee: auth.userId, roles: auth.roles || [] });
    return json({ items }, { headers: corsHeaders });
  }

  if (path === "/ops/approvals" && request.method === "GET") {
    const items = await store.listPendingApprovals(projectId);
    return json({ items }, { headers: corsHeaders });
  }

  // Oversight health over a window: decision latency, fast approvals, quorum
  // participation, tool denials. Read-only, member+ like the approvals list.
  if (path === "/ops/oversight" && request.method === "GET") {
    const requested = Number(url.searchParams.get("days") || NaN);
    const days = Number.isFinite(requested) ? Math.min(365, Math.max(1, Math.round(requested))) : 30;
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const approvals = await store.listApprovals(projectId);
    const events = await store.listEventsSince(projectId, { since: from, limit: 5000 });
    return json({ days, ...computeOversight(approvals, { events, from }) }, { headers: corsHeaders });
  }

  // MRTR: waiting runs whose upstream MCP tool asked the user a question.
  if (path === "/ops/inputs" && request.method === "GET") {
    return json({ items: await listPendingInputs(store, projectId) }, { headers: corsHeaders });
  }

  const runInput = path.match(/^\/ops\/runs\/([^/]+)\/input$/);
  if (runInput && request.method === "POST") {
    const body = await jsonRead(request);
    const result = await answerOpsInput(store, {
      env,
      projectId,
      runId: runInput[1],
      responses: body?.responses,
      actor: auth.userId,
      executeTool: opsExecuteTool,
    });
    if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  const decide = path.match(/^\/ops\/approvals\/([^/]+)\/decide$/);
  if (decide && request.method === "POST") {
    if (!isAdmin) return forbidden();
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
    const result = isPublish
      ? await decideOpsApproval(store, args)
      : await decideRunApproval(store, { ...args, executeTool: opsExecuteTool });
    if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  const taskDone = path.match(/^\/ops\/tasks\/([^/]+)\/complete$/);
  if (taskDone && request.method === "POST") {
    const task = await store.getTask(projectId, taskDone[1]);
    if (!task) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    // OPS-04: only the assignee, a holder of the task role, or an owner/admin
    // may complete a task.
    const mayComplete =
      task.assignee === auth.userId || isAdmin || (task.role && hasAnyRole(auth.roles, [task.role]));
    if (!mayComplete) return forbidden();
    const body = await jsonRead(request);
    const result = await completeOpsTask(store, {
      env,
      projectId,
      taskId: taskDone[1],
      actor: auth.userId,
      contextPatch: body.context,
      executeTool: opsExecuteTool,
    });
    return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  }

  if (path === "/ops/files" && request.method === "POST") {
    const body = await jsonRead(request);
    // OPS-06: bound the inline text payload before it reaches R2/AI Search.
    if (typeof body.text === "string" && body.text.length > OPS_MAX_FILE_TEXT_CHARS) {
      return json({ error: "file_too_large" }, { status: 413, headers: corsHeaders });
    }
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
    if (!isAdmin) return forbidden();
    const body = await jsonRead(request);
    const run = await store.getRun(projectId, body.runId);
    if (!run) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    run.killSwitch = true;
    run.status = "cancelled";
    await store.saveRun(run);
    await closeOpsRunWork(store, { projectId, runId: run.id });
    return json({ run }, { headers: corsHeaders });
  }

  const audit = path.match(/^\/ops\/runs\/([^/]+)\/audit$/);
  if (audit && request.method === "GET") {
    if (url.searchParams.get("format") === "receipt") {
      const sealed = await buildOpsRunReceipt(store, { projectId, runId: audit[1] });
      if (!sealed.ok) return json(sealed, { status: 404, headers: corsHeaders });
      return json(sealed.receipt, { headers: corsHeaders });
    }
    const exported = await exportOpsAudit(store, { projectId, runId: audit[1] });
    if (!exported.ok) return json(exported, { status: 404, headers: corsHeaders });
    if (url.searchParams.get("format") === "pdf") {
      return new Response(opsAuditPdf(exported.json), {
        headers: { "Content-Type": "application/pdf", ...corsHeaders },
      });
    }
    if (url.searchParams.get("format") === "jsonl") {
      return new Response(opsAuditJsonl(exported.json), {
        headers: { "Content-Type": "application/x-ndjson", ...corsHeaders },
      });
    }
    return json(exported.json, { headers: corsHeaders });
  }

  if (path === "/ops/audit/export" && request.method === "GET") {
    if (!isAdmin) return forbidden();
    if (url.searchParams.get("format") === "receipt") {
      const sealed = await buildOpsEvidenceReceipt(store, {
        projectId,
        from: url.searchParams.get("from") || null,
        to: url.searchParams.get("to") || null,
      });
      return json(sealed.receipt ?? sealed, { headers: corsHeaders });
    }
    const exported = await exportOpsEvidence(store, {
      projectId,
      from: url.searchParams.get("from") || null,
      to: url.searchParams.get("to") || null,
    });
    if (url.searchParams.get("format") === "jsonl") {
      return new Response(opsEvidenceJsonl(exported.json), {
        headers: { "Content-Type": "application/x-ndjson", ...corsHeaders },
      });
    }
    return json(exported.json, { headers: corsHeaders });
  }

  if (path === "/ops/guests/invite" && request.method === "POST") {
    if (!isAdmin) return forbidden();
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
    if (body.action === "approve") {
      // I7: a guest invite approves for one run only, and only against the
      // frozen payload hash — the same single-use grant an employee gets.
      const approval = await store.getApproval(projectId, String(body.approvalId || ""));
      if (!approval || approval.runId !== redeemed.guest.runId) {
        return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      }
      if (String(body.payloadHash || "") !== approval.payloadHash) {
        return json({ error: "payload_changed" }, { status: 409, headers: corsHeaders });
      }
      const decided = await decideRunApproval(store, {
        env,
        projectId,
        approvalId: approval.id,
        actor: `guest:${redeemed.guest.email}`,
        decision: body.decision === "deny" ? "deny" : "approve",
        payloadHash: approval.payloadHash,
        executeTool: opsExecuteTool,
      });
      if (!decided.ok) return json(decided, { status: 409, headers: corsHeaders });
      const updated = await store.getApproval(projectId, approval.id);
      return json(
        { ok: true, approval: { id: approval.id, status: updated?.status || approval.status } },
        { headers: corsHeaders },
      );
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
}
