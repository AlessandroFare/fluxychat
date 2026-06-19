import { json } from "../lib/http-json.js";
import * as WA from "../lib/workflow-automation.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchWorkflowAutomationRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/workflows")) return null;

  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;

  if (path === "/api/workflows" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.createWorkflow(env, body);
    return json(result);
  }

  if (path === "/api/workflows" && request.method === "GET") {
    const result = await WA.listWorkflows(env, {
      projectId, status: url.searchParams.get("status"), triggerType: url.searchParams.get("triggerType"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/[a-z0-9]+$/) && request.method === "GET") {
    const workflowId = path.split("/").pop();
    const result = await WA.getWorkflow(env, { workflowId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/workflows\/[a-z0-9]+$/) && request.method === "PATCH") {
    const workflowId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.updateWorkflow(env, { workflowId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/[a-z0-9]+\/run$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.startExecution(env, { workflowId, ...body });
    return json(result);
  }

  if (path === "/api/workflows/executions" && request.method === "GET") {
    const result = await WA.listExecutions(env, {
      projectId, workflowId: url.searchParams.get("workflowId"), status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[a-z0-9]+\/complete$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.completeExecution(env, { executionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[a-z0-9]+\/steps$/) && request.method === "GET") {
    const executionId = path.split("/")[4];
    const result = await WA.listExecutionSteps(env, { executionId });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[a-z0-9]+\/steps$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.startStep(env, { executionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/steps\/[a-z0-9]+\/complete$/) && request.method === "POST") {
    const stepId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.completeStep(env, { stepId, ...body });
    return json(result);
  }

  if (path === "/api/workflows/templates" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.createTemplate(env, body);
    return json(result);
  }

  if (path === "/api/workflows/templates" && request.method === "GET") {
    const result = await WA.listTemplates(env, {
      projectId, category: url.searchParams.get("category"), officialOnly: url.searchParams.get("officialOnly") === "true",
    });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/templates\/[a-z0-9]+\/use$/) && request.method === "POST") {
    const templateId = path.split("/")[4];
    const result = await WA.useTemplate(env, { templateId });
    return json(result);
  }

  if (path === "/api/workflows/schedules" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.createSchedule(env, body);
    return json(result);
  }

  if (path === "/api/workflows/schedules" && request.method === "GET") {
    const result = await WA.listSchedules(env, {
      projectId, enabled: url.searchParams.get("enabled") ? url.searchParams.get("enabled") === "true" : undefined,
    });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/schedules\/[a-z0-9]+$/) && request.method === "PATCH") {
    const scheduleId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.updateSchedule(env, { scheduleId, ...body });
    return json(result);
  }

  if (path === "/api/workflows/stats" && request.method === "GET") {
    const result = await WA.getWorkflowStats(env, { projectId });
    return json(result);
  }

  return null;
}
