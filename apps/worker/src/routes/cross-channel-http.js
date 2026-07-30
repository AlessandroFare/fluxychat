import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  bindChannelIdentity,
  listIdentityBindings,
  mergeCustomerProfiles,
  recordJourneyStep,
  listJourneyHistory,
  getUnifiedCustomerView,
} from "../lib/cross-channel-identity.js";

export async function dispatchCrossChannelRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/cross-channel")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/cross-channel/bindings") {
    const customerId = url.searchParams.get("customerId");
    const bindings = await listIdentityBindings(env, { projectId, customerId });
    return respond({ bindings, count: bindings.length }, h);
  }

  if (request.method === "POST" && path === "/admin/cross-channel/bindings") {
    const body = await request.json().catch(() => null);
    const result = await bindChannelIdentity(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/cross-channel/merge") {
    const body = await request.json().catch(() => null);
    const result = await mergeCustomerProfiles(env, {
      projectId,
      primaryCustomerId: body?.primaryCustomerId,
      secondaryCustomerId: body?.secondaryCustomerId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cross-channel/journey") {
    const body = await request.json().catch(() => null);
    const result = await recordJourneyStep(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/cross-channel/journey") {
    const customerId = url.searchParams.get("customerId");
    if (!customerId) return respond({ error: "customerId required" }, h, 400);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const journey = await listJourneyHistory(env, { projectId, customerId, limit });
    return respond({ journey, count: journey.length }, h);
  }

  const unifiedMatch = path.match(/^\/admin\/cross-channel\/customers\/([^/]+)$/);
  if (unifiedMatch && request.method === "GET") {
    const customerId = decodeURIComponent(unifiedMatch[1]);
    const view = await getUnifiedCustomerView(env, { projectId, customerId });
    if (!view) return respond({ error: "not_found" }, h, 404);
    return respond(view, h);
  }

  return null;
}
