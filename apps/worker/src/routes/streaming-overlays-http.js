/**
 * P20-G: Streaming Overlays HTTP Routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createOverlay, getOverlay, listOverlays, deleteOverlay, getOverlayWidget,
} from "../lib/streaming-overlays.js";

export async function dispatchOverlayRoutes(request, url, h) {
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

  if (url.pathname === "/overlays" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.roomId) return json({ error: "name and roomId required" }, { status: 400 });
    const ov = await createOverlay(env, {
      projectId: auth.projectId, roomId: body.roomId, name: body.name,
      overlayType: body.overlayType, config: body.config, style: body.style,
      refreshSeconds: body.refreshSeconds,
    });
    return json(ov, { status: 201 });
  }

  if (url.pathname === "/overlays" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const ovs = await listOverlays(env, { projectId: auth.projectId, roomId: params.roomId });
    return json({ overlays: ovs, count: ovs.length });
  }

  const ovMatch = url.pathname.match(/^\/overlays\/([^/]+)$/);
  if (ovMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ov = await getOverlay(env, { projectId: auth.projectId, overlayId: decodeURIComponent(ovMatch[1]) });
    if (!ov) return json({ error: "not_found" }, { status: 404 });
    return json(ov);
  }
  if (ovMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await deleteOverlay(env, { projectId: auth.projectId, overlayId: decodeURIComponent(ovMatch[1]) });
    return json({ ok });
  }

  const widgetMatch = url.pathname.match(/^\/overlays\/([^/]+)\/widget$/);
  if (widgetMatch && request.method === "GET") {
    const widget = await getOverlayWidget(env, {
      projectId: "default", overlayId: decodeURIComponent(widgetMatch[1]),
    });
    if (!widget) return json({ error: "not_found" }, { status: 404 });
    return json(widget);
  }

  return null;
}
