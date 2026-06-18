import { pickRouteDeps } from "./route-http-deps.js";
import {
  listActions,
  getAction,
  createAction,
  updateAction,
  deleteAction,
  executeAction,
  listExecutions,
} from "../lib/ai-actions.js";

/**
 * AI Actions HTTP routes.
 *
 * GET    /ai-actions              — List actions
 * POST   /ai-actions              — Create action
 * GET    /ai-actions/:id          — Get action
 * PATCH  /ai-actions/:id          — Update action
 * DELETE /ai-actions/:id          — Delete action
 * POST   /ai-actions/:id/execute  — Execute action
 * GET    /ai-actions/:id/executions — List executions
 */
export async function dispatchAiActionsRoutes(request, url, h) {
  const match = url.pathname.match(/^\/ai-actions(?:\/([^/]+))?(?:\/(execute|executions))?$/);
  if (!match) return null;

  const actionId = match[1] || null;
  const subAction = match[2] || null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    // GET /ai-actions
    if (request.method === "GET" && !actionId) {
      const actions = await listActions(env, { projectId: auth.projectId });
      return json({ actions, count: actions.length }, { headers: corsHeaders });
    }

    // POST /ai-actions — create
    if (request.method === "POST" && !actionId) {
      if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json();
      const { name, description, kind, config } = body || {};
      if (!name || !kind) {
        return json({ error: "name and kind are required" }, { status: 400, headers: corsHeaders });
      }
      const validKinds = ["webhook", "email", "ticket", "github_issue", "custom"];
      if (!validKinds.includes(kind)) {
        return json({ error: `kind must be one of: ${validKinds.join(", ")}` }, { status: 400, headers: corsHeaders });
      }
      const action = await createAction(env, {
        projectId: auth.projectId,
        name,
        description,
        kind,
        config: config || {},
      });
      return json(action, { status: 201, headers: corsHeaders });
    }

    // GET /ai-actions/:id
    if (request.method === "GET" && actionId && !subAction) {
      const action = await getAction(env, { projectId: auth.projectId, actionId });
      if (!action) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json(action, { headers: corsHeaders });
    }

    // PATCH /ai-actions/:id
    if (request.method === "PATCH" && actionId) {
      if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json();
      const updated = await updateAction(env, { projectId: auth.projectId, actionId, ...body });
      if (!updated) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json(updated, { headers: corsHeaders });
    }

    // DELETE /ai-actions/:id
    if (request.method === "DELETE" && actionId) {
      if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      await deleteAction(env, { projectId: auth.projectId, actionId });
      return json({ deleted: actionId }, { headers: corsHeaders });
    }

    // POST /ai-actions/:id/execute
    if (request.method === "POST" && actionId && subAction === "execute") {
      const body = await request.json();
      const result = await executeAction(env, {
        projectId: auth.projectId,
        actionId,
        roomId: body?.roomId || null,
        userId: auth.userId,
        input: body?.input || body?.payload || {},
        traceId: h.traceId,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    // GET /ai-actions/:id/executions
    if (request.method === "GET" && actionId && subAction === "executions") {
      const limit = Number(url.searchParams.get("limit")) || 20;
      const executions = await listExecutions(env, { projectId: auth.projectId, actionId, limit });
      return json({ executions, count: executions.length }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("ai_actions.error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}

