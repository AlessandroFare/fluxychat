import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listCrmConnections,
  upsertCrmConnection,
  syncCrmConnection,
  listCrmSyncHistory,
  lookupCrmContact,
  createCrmTicket,
  handoffToAgent,
} from "../lib/crm-adapters.js";

export async function dispatchCrmRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/crm")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/crm/connections") {
    const connections = await listCrmConnections(env, { projectId });
    return respond({ connections }, h);
  }

  if (request.method === "POST" && path === "/admin/crm/connections") {
    const body = await request.json().catch(() => null);
    if (!body?.provider) return respond({ error: "provider required" }, h, 400);
    const result = await upsertCrmConnection(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/crm/sync") {
    const body = await request.json().catch(() => null);
    if (!body?.provider) return respond({ error: "provider required" }, h, 400);
    const result = await syncCrmConnection(env, {
      projectId,
      provider: body.provider,
      direction: body.direction,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/crm/sync/history") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const history = await listCrmSyncHistory(env, { projectId, limit });
    return respond({ history, count: history.length }, h);
  }

  if (request.method === "GET" && path === "/admin/crm/contacts/lookup") {
    const provider = url.searchParams.get("provider");
    const email = url.searchParams.get("email");
    const externalId = url.searchParams.get("externalId");
    if (!provider) return respond({ error: "provider required" }, h, 400);
    const contact = await lookupCrmContact(env, { projectId, provider, email, externalId });
    return respond({ contact }, h);
  }

  if (request.method === "POST" && path === "/admin/crm/tickets") {
    const body = await request.json().catch(() => null);
    if (!body?.provider) return respond({ error: "provider required" }, h, 400);
    const result = await createCrmTicket(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/crm/handoff") {
    const body = await request.json().catch(() => null);
    if (!body?.provider || !body?.roomId || !body?.agentId) {
      return respond({ error: "provider, roomId, and agentId required" }, h, 400);
    }
    const result = await handoffToAgent(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  return null;
}
