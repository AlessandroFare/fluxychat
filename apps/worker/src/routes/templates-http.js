/**
 * P19-H: Room Templates HTTP Routes.
 *
 * GET  /room-templates                 — list room templates
 * GET  /room-templates/:id            — get template
 * POST /room-templates                — create custom template
 * PATCH /room-templates/:id           — update custom template
 * DELETE /room-templates/:id          — delete custom template
 * POST /room-templates/:id/install    — install template
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  installTemplate,
} from "../lib/room-templates.js";

export async function dispatchTemplatesRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  // GET /room-templates
  if (url.pathname === "/room-templates" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const category = url.searchParams.get("category") || undefined;
    const templates = await listTemplates(env, { projectId: a.projectId, category });
    return json({ templates });
  }

  // POST /templates/:id/install
  const installMatch = url.pathname.match(/^\/room-templates\/([^/]+)\/install$/);
  if (installMatch && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(installMatch[1]);
    const body = await request.json().catch(() => ({}));
    const result = await installTemplate(env, {
      projectId: a.projectId,
      templateId: id,
      roomName: body.roomName,
      roomId: body.roomId,
    });
    return json(result, { status: result.ok ? 200 : 404 });
  }

  // GET /templates/:id
  const idMatch = url.pathname.match(/^\/room-templates\/([^/]+)$/);
  if (idMatch && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const template = await getTemplate(env, { projectId: a.projectId, idOrSlug: id });
    if (!template) return json({ error: "not_found" }, { status: 404 });
    return json(template);
  }

  // POST /templates
  if (url.pathname === "/room-templates" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.slug) return json({ error: "name and slug required" }, { status: 400 });
    const result = await createTemplate(env, {
      projectId: a.projectId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      category: body.category,
      config: body.config,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  // PATCH /templates/:id
  if (idMatch && request.method === "PATCH") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const body = await request.json().catch(() => null);
    const result = await updateTemplate(env, { projectId: a.projectId, id, ...body });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  // DELETE /templates/:id
  if (idMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const result = await deleteTemplate(env, { projectId: a.projectId, id });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  return null;
}

