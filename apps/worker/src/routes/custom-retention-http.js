import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  listRetentionPolicies,
  getRetentionPolicy,
  getEffectiveRetention,
  getPurgeCandidates,
  recordPurge,
  getPurgeLogs,
  getRetentionStats,
} from "../lib/custom-retention.js";

export async function dispatchCustomRetentionRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/retention")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/retention/policies") {
    const dataType = url.searchParams.get("dataType");
    const roomId = url.searchParams.get("roomId");
    const policies = await listRetentionPolicies(env, { projectId, dataType, roomId });
    return respond({ policies }, h);
  }

  if (request.method === "POST" && path === "/admin/retention/policies") {
    const body = await request.json();
    const result = await createRetentionPolicy(env, {
      projectId,
      name: body.name,
      dataType: body.dataType,
      roomId: body.roomId,
      retentionDays: body.retentionDays,
      autoPurge: body.autoPurge,
      archiveBeforeDelete: body.archiveBeforeDelete,
      requireApproval: body.requireApproval,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/retention\/policies\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateRetentionPolicy(env, { id, projectId, ...body });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/retention\/policies\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteRetentionPolicy(env, { id, projectId });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/retention/effective") {
    const dataType = url.searchParams.get("dataType");
    const roomId = url.searchParams.get("roomId");
    if (!dataType) return respond({ error: "dataType is required" }, h, 400);
    const policy = await getEffectiveRetention(env, { projectId, dataType, roomId });
    return respond({ policy }, h);
  }

  if (request.method === "GET" && path === "/admin/retention/purge-candidates") {
    const candidates = await getPurgeCandidates(env, { projectId });
    return respond({ candidates }, h);
  }

  if (request.method === "GET" && path === "/admin/retention/logs") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const logs = await getPurgeLogs(env, { projectId, limit });
    return respond({ logs }, h);
  }

  if (request.method === "GET" && path === "/admin/retention/stats") {
    const stats = await getRetentionStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
