import { resolveAdminContext } from "../lib/admin-route-context.js";
import { validateLimit } from "../lib/validation.js";
import {
  createExportSchedule,
  listExportSchedules,
  deleteExportSchedule,
  toggleExportSchedule,
  queryFilteredAuditEvents,
  streamExport,
  recordExportRun,
  getExportRuns,
  getAuditStats,
} from "../lib/audit-log-export.js";

export async function dispatchAuditExportRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/audit-export")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/audit-export/schedules") {
    const schedules = await listExportSchedules(env, { projectId });
    return respond({ schedules }, h);
  }

  if (request.method === "POST" && path === "/admin/audit-export/schedules") {
    const body = await request.json();
    const result = await createExportSchedule(env, {
      projectId,
      name: body.name,
      frequency: body.frequency,
      format: body.format,
      filterActor: body.filterActor,
      filterAction: body.filterAction,
      filterResource: body.filterResource,
      filterSeverity: body.filterSeverity,
      destinationType: body.destinationType,
      destinationUrl: body.destinationUrl,
      destinationConfig: body.destinationConfig,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/audit-export\/schedules\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteExportSchedule(env, { id, projectId });
    return respond(result, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/audit-export\/schedules\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await toggleExportSchedule(env, { id, enabled: body.enabled });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/audit-export/events") {
    const limitResult = validateLimit(url.searchParams.get("limit"), { defaultValue: 5000, max: 5000 });
    if (limitResult.error) return respond({ error: "bad_request", message: limitResult.error }, h, 400);
    const events = await queryFilteredAuditEvents(env, {
      projectId,
      startTime: url.searchParams.get("startTime"),
      endTime: url.searchParams.get("endTime"),
      actor: url.searchParams.get("actor"),
      action: url.searchParams.get("action"),
      resourceType: url.searchParams.get("resourceType"),
      severity: url.searchParams.get("severity"),
      limit: limitResult.value,
    });
    return respond({ events }, h);
  }

  if (request.method === "GET" && path === "/admin/audit-export/stream") {
    const format = url.searchParams.get("format") || "json";
    const startTime = url.searchParams.get("startTime") || new Date(Date.now() - 86400000).toISOString();
    const endTime = url.searchParams.get("endTime") || new Date().toISOString();
    const content = await streamExport(env, { projectId, startTime, endTime, format });
    const contentType = format === "json" ? "application/json" : "text/plain";
    return new Response(content, { headers: { "Content-Type": contentType } });
  }

  if (request.method === "GET" && path === "/admin/audit-export/runs") {
    const limitResult = validateLimit(url.searchParams.get("limit"), { defaultValue: 20, max: 1000 });
    if (limitResult.error) return respond({ error: "bad_request", message: limitResult.error }, h, 400);
    const runs = await getExportRuns(env, { projectId, limit: limitResult.value });
    return respond({ runs }, h);
  }

  if (request.method === "GET" && path === "/admin/audit-export/stats") {
    const stats = await getAuditStats(env, {
      projectId,
      startTime: url.searchParams.get("startTime"),
      endTime: url.searchParams.get("endTime"),
    });
    return respond({ stats }, h);
  }

  return null;
}
