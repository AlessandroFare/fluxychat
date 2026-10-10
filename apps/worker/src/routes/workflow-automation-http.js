import * as WA from "../lib/workflow-automation.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

const WEBHOOK_METHODS = new Set(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]);

function queryObject(url) {
  const query = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "token") continue;
    query[k] = v;
  }
  return query;
}

function headerObject(request) {
  const headers = {};
  for (const [k, v] of request.headers.entries()) {
    const key = k.toLowerCase();
    if (key === "authorization" || key === "cookie") continue;
    if (key.startsWith("x-") || key === "content-type") headers[key] = v;
  }
  return headers;
}

async function readHookBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 4096);
  }
}

export async function dispatchWorkflowAutomationRoutes(request, url, h) {
  const json = h.json;
  const path = url.pathname;
  const workerEnv = h.env;

  const waitMatch = path.match(/^\/hooks\/workflows\/wait\/([^/]+)$/);
  if (waitMatch && (request.method === "POST" || request.method === "GET")) {
    const result = await WA.resumeWaitingExecution(workerEnv, {
      executionId: waitMatch[1],
      token: url.searchParams.get("token") || request.headers.get("X-Wait-Token"),
    });
    return json(result, result.ok === false ? result.status || 400 : 200);
  }

  const hookMatch = path.match(/^\/hooks\/workflows\/([^/]+)$/);
  if (hookMatch) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...(h.corsHeaders || {}),
          "Access-Control-Allow-Methods": "DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Wait-Token",
        },
      });
    }
    if (!WEBHOOK_METHODS.has(request.method)) return json({ error: "method_not_allowed" }, 405);
    const body = await readHookBody(request);
    const result = await WA.ingestWorkflowWebhook(workerEnv, {
      hookPath: hookMatch[1],
      method: request.method,
      query: queryObject(url),
      headers: headerObject(request),
      body,
    });
    return json(result, result.ok === false ? result.status || 400 : 200);
  }

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

  if (path === "/api/workflows/state" && request.method === "GET") {
    const result = await WA.getWorkflowState(env, {
      projectId,
      scope: url.searchParams.get("scope"),
      scopeId: url.searchParams.get("scopeId"),
      key: url.searchParams.get("key"),
    });
    return json(result, result.ok === false ? 400 : 200);
  }

  if (path === "/api/workflows/state" && request.method === "PUT") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.setWorkflowState(env, {
      projectId,
      scope: body.scope,
      scopeId: body.scopeId,
      key: body.key,
      value: body.value,
      ttlSeconds: body.ttlSeconds,
    });
    return json(result, result.ok === false ? 400 : 200);
  }

  if (path === "/api/workflows/state" && request.method === "DELETE") {
    const result = await WA.deleteWorkflowState(env, {
      projectId,
      scope: url.searchParams.get("scope"),
      scopeId: url.searchParams.get("scopeId"),
      key: url.searchParams.get("key"),
    });
    return json(result, result.ok === false ? 400 : 200);
  }

  if (path === "/api/workflows/events" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.dispatchWorkflowEvent(env, {
      projectId,
      triggerType: body.triggerType || body.type,
      triggerData: body.triggerData || body.payload,
      context: body.context,
    });
    return json(result, result.ok === false ? 400 : 200);
  }

  if (path.match(/^\/api\/workflows\/[^/]+\/activate$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const result = await WA.activateWorkflow(env, { workflowId, projectId });
    const status = result.error === "webhook_path_conflict" ? 409 : result.error ? 404 : 200;
    return json(result, status);
  }

  if (path.match(/^\/api\/workflows\/[^/]+\/deactivate$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const result = await WA.deactivateWorkflow(env, { workflowId, projectId });
    return json(result, result.error ? 404 : 200);
  }

  if (path.match(/^\/api\/workflows\/[^/]+\/archive$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const result = await WA.archiveWorkflow(env, { workflowId, projectId });
    return json(result, result.error ? 404 : 200);
  }

  if (path.match(/^\/api\/workflows\/[^/]+\/unarchive$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const result = await WA.unarchiveWorkflow(env, { workflowId, projectId });
    return json(result, result.error ? 404 : 200);
  }

  if (path.match(/^\/api\/workflows\/[^/]+\/run$/) && request.method === "POST") {
    const workflowId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.startExecution(env, { workflowId, projectId, ...body });
    return json(result, result.error ? 400 : 200);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+\/retry$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const result = await WA.retryExecution(env, { executionId, projectId });
    return json(result, result.error ? 404 : 200);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+\/stop$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const result = await WA.stopExecution(env, { executionId, projectId });
    return json(result, result.error ? 400 : 200);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+$/) && request.method === "DELETE") {
    const executionId = path.split("/")[4];
    const result = await WA.deleteExecution(env, { executionId, projectId });
    return json(result, result.error ? 404 : 200);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+$/) && request.method === "GET") {
    const executionId = path.split("/")[4];
    const result = await WA.getExecution(env, { executionId, projectId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path === "/api/workflows/executions" && request.method === "GET") {
    const result = await WA.listExecutions(env, {
      projectId, workflowId: url.searchParams.get("workflowId"), status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+\/complete$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.completeExecution(env, { executionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+\/steps$/) && request.method === "GET") {
    const executionId = path.split("/")[4];
    const result = await WA.listExecutionSteps(env, { executionId });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/executions\/[^/]+\/steps$/) && request.method === "POST") {
    const executionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.startStep(env, { executionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/workflows\/steps\/[^/]+\/complete$/) && request.method === "POST") {
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

  if (path.match(/^\/api\/workflows\/templates\/[^/]+\/use$/) && request.method === "POST") {
    const templateId = path.split("/")[4];
    const result = await WA.useTemplate(env, { templateId });
    return json(result);
  }

  if (path === "/api/workflows/schedules/due" && request.method === "POST") {
    const result = await WA.runDueWorkflowSchedules(env);
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

  if (path.match(/^\/api\/workflows\/schedules\/[^/]+$/) && request.method === "PATCH") {
    const scheduleId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await WA.updateSchedule(env, { scheduleId, ...body });
    return json(result);
  }

  if (path === "/api/workflows/stats" && request.method === "GET") {
    const result = await WA.getWorkflowStats(env, { projectId });
    return json(result);
  }

  const idMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
  if (idMatch && !["executions", "state", "events", "templates", "schedules", "stats", "steps"].includes(idMatch[1])) {
    const workflowId = idMatch[1];
    if (request.method === "GET") {
      const result = await WA.getWorkflow(env, { workflowId, projectId });
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (request.method === "PATCH" || request.method === "PUT") {
      const body = withAuthProjectId(await request.json(), projectId);
      const result = await WA.updateWorkflow(env, { workflowId, ...body });
      return json(result);
    }
    if (request.method === "DELETE") {
      const result = await WA.deleteAutomationWorkflow(env, { workflowId, projectId });
      return json(result, result.error ? 404 : 200);
    }
  }

  return null;
}
