/**
 * P14-I: White-label SDK HTTP Routes.
 *
 * GET  /white-label/config              — get project white-label config
 * POST /white-label/config              — upsert white-label config
 * POST /white-label/embed-snippet       — generate embed snippet
 * POST /white-label/resellers           — create reseller
 * GET  /white-label/resellers           — list resellers
 * GET  /white-label/resellers/:id       — get reseller
 * PATCH /white-label/resellers/:id      — update reseller
 * DELETE /white-label/resellers/:id     — delete reseller
 * GET  /white-label/resellers/stats     — reseller stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  getWhiteLabelConfig,
  upsertWhiteLabelConfig,
  generateEmbedSnippet,
  createReseller,
  listResellers,
  getReseller,
  updateReseller,
  deleteReseller,
  getResellerStats,
} from "../lib/white-label.js";

export async function dispatchWhiteLabelRoutes(request, url, h) {
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

  async function adminAuth() {
    const a = await auth();
    if (!a) return null;
    if (!hasAnyRole(a, ["owner", "admin"])) return null;
    return a;
  }

  // GET /white-label/config
  if (url.pathname === "/white-label/config" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const config = await getWhiteLabelConfig(env, { projectId: a.projectId });
    return json(config);
  }

  // POST /white-label/config
  if (url.pathname === "/white-label/config" && request.method === "POST") {
    const a = await adminAuth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "body required" }, { status: 400 });

    const config = await upsertWhiteLabelConfig(env, {
      projectId: a.projectId,
      brandName: body.brandName,
      brandLogoUrl: body.brandLogoUrl,
      brandFaviconUrl: body.brandFaviconUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      backgroundColor: body.backgroundColor,
      textColor: body.textColor,
      fontFamily: body.fontFamily,
      borderRadius: body.borderRadius,
      customCss: body.customCss,
      customJs: body.customJs,
      welcomeMessage: body.welcomeMessage,
      inputPlaceholder: body.inputPlaceholder,
      showBranding: body.showBranding,
      showPoweredBy: body.showPoweredBy,
      allowedOrigins: body.allowedOrigins,
    });
    return json(config, { status: 201 });
  }

  // POST /white-label/embed-snippet
  if (url.pathname === "/white-label/embed-snippet" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => ({}));
    const snippet = await generateEmbedSnippet(env, { projectId: a.projectId, baseUrl: body?.baseUrl });
    return json({ snippet });
  }

  // GET /white-label/resellers/stats
  if (url.pathname === "/white-label/resellers/stats" && request.method === "GET") {
    const a = await adminAuth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getResellerStats(env, { projectId: a.projectId });
    return json(stats);
  }

  // POST /white-label/resellers
  if (url.pathname === "/white-label/resellers" && request.method === "POST") {
    const a = await adminAuth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.resellerName || !body?.resellerEmail) {
      return json({ error: "resellerName and resellerEmail required" }, { status: 400 });
    }
    const result = await createReseller(env, {
      projectId: a.projectId,
      resellerName: body.resellerName,
      resellerEmail: body.resellerEmail,
      resellerDomain: body.resellerDomain,
      commissionPercent: body.commissionPercent,
      maxProjects: body.maxProjects,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  // GET /white-label/resellers
  if (url.pathname === "/white-label/resellers" && request.method === "GET") {
    const a = await adminAuth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const items = await listResellers(env, { projectId: a.projectId });
    return json({ items });
  }

  // Reseller by ID routes
  const resellerMatch = url.pathname.match(/^\/white-label\/resellers\/([^/]+)$/);
  if (resellerMatch) {
    const a = await adminAuth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(resellerMatch[1]);

    if (request.method === "GET") {
      const reseller = await getReseller(env, { projectId: a.projectId, id });
      if (!reseller) return json({ error: "not_found" }, { status: 404 });
      return json(reseller);
    }

    if (request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const result = await updateReseller(env, { projectId: a.projectId, id, ...body });
      if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      const result = await deleteReseller(env, { projectId: a.projectId, id });
      if (!result.ok) return json({ error: result.error }, { status: 404 });
      return json({ ok: true });
    }
  }

  return null;
}
