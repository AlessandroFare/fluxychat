/**
 * P20-I: Store / Field Ops Mode HTTP Routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createTemplate, getTemplate, listTemplates, deleteTemplate,
  submitUpdate, listUpdates, getUnsyncedUpdates, markSynced,
} from "../lib/field-ops.js";

export async function dispatchFieldOpsRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth || !hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }
  async function anyAuth() { return verifyJwtAndGetContext(request, env).catch(() => null); }

  /* Templates */
  if (url.pathname === "/field-ops/templates" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name required" }, { status: 400 });
    const tpl = await createTemplate(env, {
      projectId: auth.projectId, name: body.name, description: body.description,
      templateType: body.templateType, fields: body.fields,
      safetyAlerts: body.safetyAlerts, photoRequired: body.photoRequired,
      offlineQueue: body.offlineQueue,
    });
    return json(tpl, { status: 201 });
  }

  if (url.pathname === "/field-ops/templates" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const tpls = await listTemplates(env, { projectId: auth.projectId });
    return json({ templates: tpls, count: tpls.length });
  }

  const tplMatch = url.pathname.match(/^\/field-ops\/templates\/([^/]+)$/);
  if (tplMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const tpl = await getTemplate(env, { projectId: auth.projectId, templateId: decodeURIComponent(tplMatch[1]) });
    if (!tpl) return json({ error: "not_found" }, { status: 404 });
    return json(tpl);
  }
  if (tplMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await deleteTemplate(env, { projectId: auth.projectId, templateId: decodeURIComponent(tplMatch[1]) });
    return json({ ok });
  }

  /* Updates */
  if (url.pathname === "/field-ops/updates" && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.roomId || !body?.content) return json({ error: "roomId and content required" }, { status: 400 });
    const upd = await submitUpdate(env, {
      projectId: auth.projectId, templateId: body.templateId, roomId: body.roomId,
      userId: auth.userId, updateType: body.updateType, content: body.content,
      photoUrl: body.photoUrl, metadata: body.metadata,
    });
    return json(upd, { status: 201 });
  }

  if (url.pathname === "/field-ops/updates" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const upds = await listUpdates(env, {
      projectId: auth.projectId, roomId: params.roomId, updateType: params.updateType,
    });
    return json({ updates: upds, count: upds.length });
  }

  if (url.pathname === "/field-ops/updates/unsynced" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const upds = await getUnsyncedUpdates(env, { projectId: auth.projectId });
    return json({ updates: upds, count: upds.length });
  }

  const syncMatch = url.pathname.match(/^\/field-ops\/updates\/([^/]+)\/sync$/);
  if (syncMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await markSynced(env, { projectId: auth.projectId, updateId: decodeURIComponent(syncMatch[1]) });
    return json({ ok });
  }

  return null;
}
