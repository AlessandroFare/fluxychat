/**
 * CP-071: Durable agent workflow HTTP routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  getDurableWorkflow,
  listDurableWorkflows,
  resumeDurableWorkflow,
  startDurableWorkflow,
} from "../lib/agent-durable-workflow.js";

function defaultExecuteStep(step, state) {
  if (step.type === "wait") {
    return { waited: step.config?.ms || 0 };
  }
  if (step.type === "human_approval") {
    return { pendingApproval: true, stepId: step.id };
  }
  return { ok: true, stepId: step.id, variables: state.variables };
}

export async function dispatchAgentDurableWorkflowRoutes(request, url, h) {
  const { env, json, corsHeaders, verifyJwtAndGetContext, logError, requestLogCtx, hasAnyRole } =
    pickRouteDeps(h, [
      "env",
      "json",
      "corsHeaders",
      "verifyJwtAndGetContext",
      "logError",
      "requestLogCtx",
      "hasAnyRole",
    ]);

  async function authAdmin() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!a || !hasAnyRole(a, ["owner", "admin"])) return null;
    return a;
  }

  if (url.pathname === "/agents/durable-workflows" && request.method === "GET") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const workflows = await listDurableWorkflows(env, {
      projectId: a.projectId,
      status: url.searchParams.get("status") || undefined,
      limit: parseInt(url.searchParams.get("limit") || "25", 10),
    });
    return json({ workflows });
  }

  if (url.pathname === "/agents/durable-workflows" && request.method === "POST") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.definition) {
      return json({ error: "name_and_definition_required" }, { status: 400 });
    }
    const result = await startDurableWorkflow(env, {
      projectId: a.projectId,
      name: body.name,
      definition: body.definition,
      input: body.input,
      executeStep: defaultExecuteStep,
    });
    return json(result, { status: 201 });
  }

  const idMatch = url.pathname.match(/^\/agents\/durable-workflows\/([^/]+)$/);
  if (idMatch && request.method === "GET") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const wf = await getDurableWorkflow(env, {
      projectId: a.projectId,
      workflowId: decodeURIComponent(idMatch[1]),
    });
    return wf ? json(wf) : json({ error: "not_found" }, { status: 404 });
  }

  const resumeMatch = url.pathname.match(/^\/agents\/durable-workflows\/([^/]+)\/resume$/);
  if (resumeMatch && request.method === "POST") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const result = await resumeDurableWorkflow(env, {
      projectId: a.projectId,
      workflowId: decodeURIComponent(resumeMatch[1]),
      executeStep: defaultExecuteStep,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  return null;
}
