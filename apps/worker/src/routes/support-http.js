import { json } from "../lib/http-json.js";
import * as Support from "../lib/enterprise-support.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchSupportRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/support")) return null;

  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;

  if (path === "/api/support/tickets" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.createTicket(env, body);
    return json(result);
  }

  if (path === "/api/support/tickets" && request.method === "GET") {
    const result = await Support.listTickets(env, {
      projectId, status: url.searchParams.get("status"), priority: url.searchParams.get("priority"),
      assignedTo: url.searchParams.get("assignedTo"), limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/support\/tickets\/[a-z0-9]+$/) && request.method === "GET") {
    const ticketId = path.split("/").pop();
    const result = await Support.getTicket(env, { ticketId, projectId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/support\/tickets\/[a-z0-9]+$/) && request.method === "PATCH") {
    const ticketId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.updateTicket(env, { ticketId, projectId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/support\/tickets\/[a-z0-9]+\/messages$/) && request.method === "POST") {
    const ticketId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.addTicketMessage(env, { ticketId, projectId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/support\/tickets\/[a-z0-9]+\/messages$/) && request.method === "GET") {
    const ticketId = path.split("/")[4];
    const result = await Support.listTicketMessages(env, {
      ticketId, projectId, includeInternal: url.searchParams.get("includeInternal") === "true",
    });
    return json(result);
  }

  if (path === "/api/support/sla" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.createSLAPolicy(env, body);
    return json(result);
  }

  if (path === "/api/support/sla" && request.method === "GET") {
    const result = await Support.listSLAPolicies(env, { projectId });
    return json(result);
  }

  if (path === "/api/support/escalation-rules" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.createEscalationRule(env, body);
    return json(result);
  }

  if (path === "/api/support/escalation-rules" && request.method === "GET") {
    const result = await Support.listEscalationRules(env, { projectId });
    return json(result);
  }

  if (path === "/api/support/kb" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.createKBArticle(env, body);
    return json(result);
  }

  if (path === "/api/support/kb" && request.method === "GET") {
    const result = await Support.listKBArticles(env, {
      projectId, category: url.searchParams.get("category"), status: url.searchParams.get("status"),
      search: url.searchParams.get("search"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/support\/kb\/[a-z0-9]+$/) && request.method === "PATCH") {
    const articleId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.updateKBArticle(env, { articleId, projectId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/support\/kb\/[a-z0-9]+\/impression$/) && request.method === "POST") {
    const articleId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.recordKBImpression(env, { articleId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/support/surveys" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.createSatisfactionSurvey(env, body);
    return json(result);
  }

  if (path.match(/^\/api\/support\/surveys\/[a-z0-9]+\/respond$/) && request.method === "POST") {
    const surveyId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Support.respondToSurvey(env, { surveyId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/support/stats" && request.method === "GET") {
    const result = await Support.getSupportStats(env, { projectId });
    return json(result);
  }

  return null;
}
