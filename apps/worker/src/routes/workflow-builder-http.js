import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createWorkflow, updateWorkflow, getWorkflow, listWorkflows, deleteWorkflow,
  executeWorkflow, getWorkflowRuns,
  createTemplate, listTemplates, applyTemplate, getWorkflowStats,
} from "../lib/workflow-builder.js";

export async function dispatchWorkflowBuilderRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/workflows")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/workflows") {
    const workflows = await listWorkflows(env, { projectId });
    return respond({ workflows }, h);
  }

  if (request.method === "POST" && path === "/admin/workflows") {
    const body = await request.json();
    const result = await createWorkflow(env, {
      projectId,
      name: body.name,
      description: body.description,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
      steps: body.steps,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/workflows\/[^/]+$/)) {
    const id = path.split("/").pop();
    const workflow = await getWorkflow(env, { id, projectId });
    if (!workflow) return respond({ error: "not_found" }, h, 404);
    return respond({ workflow }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/workflows\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateWorkflow(env, { id, projectId, ...body });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/workflows\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteWorkflow(env, { id, projectId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/workflows/execute") {
    const body = await request.json();
    const result = await executeWorkflow(env, {
      workflowId: body.workflowId,
      projectId,
      triggerData: body.triggerData,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/workflows/runs") {
    const workflowId = url.searchParams.get("workflowId");
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const runs = await getWorkflowRuns(env, { workflowId, projectId, limit });
    return respond({ runs }, h);
  }

  if (request.method === "POST" && path === "/admin/workflows/templates") {
    const body = await request.json();
    const result = await createTemplate(env, {
      projectId,
      name: body.name,
      description: body.description,
      category: body.category,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
      steps: body.steps,
      isSystem: body.isSystem,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/workflows/templates") {
    const templates = await listTemplates(env, { projectId });
    return respond({ templates }, h);
  }

  if (request.method === "POST" && path === "/admin/workflows/apply-template") {
    const body = await request.json();
    const result = await applyTemplate(env, { templateId: body.templateId, projectId });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/workflows/stats") {
    const stats = await getWorkflowStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
