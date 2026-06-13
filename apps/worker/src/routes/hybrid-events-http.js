/**
 * P20-H: Hybrid Event Mode HTTP Routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createHybridEvent, getHybridEvent, listHybridEvents,
  checkIn, checkOut, listCheckIns, getHybridStats,
} from "../lib/hybrid-events.js";

export async function dispatchHybridRoutes(request, url, h) {
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

  if (url.pathname === "/hybrid/events" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.roomId) return json({ error: "name and roomId required" }, { status: 400 });
    const ev = await createHybridEvent(env, {
      projectId: auth.projectId, roomId: body.roomId, eventId: body.eventId,
      name: body.name, description: body.description, mode: body.mode,
      venueUrl: body.venueUrl, syncedPolls: body.syncedPolls,
      sharedQa: body.sharedQa, unifiedChat: body.unifiedChat,
    });
    return json(ev, { status: 201 });
  }

  if (url.pathname === "/hybrid/events" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const evs = await listHybridEvents(env, { projectId: auth.projectId, roomId: params.roomId });
    return json({ events: evs, count: evs.length });
  }

  const evMatch = url.pathname.match(/^\/hybrid\/events\/([^/]+)$/);
  if (evMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ev = await getHybridEvent(env, { projectId: auth.projectId, hybridEventId: decodeURIComponent(evMatch[1]) });
    if (!ev) return json({ error: "not_found" }, { status: 404 });
    return json(ev);
  }

  const checkinMatch = url.pathname.match(/^\/hybrid\/events\/([^/]+)\/checkin$/);
  if (checkinMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await checkIn(env, {
      projectId: auth.projectId, hybridEventId: decodeURIComponent(checkinMatch[1]),
      userId: auth.userId, checkinType: body?.checkinType,
    });
    return json(result, { status: 201 });
  }

  const checkoutMatch = url.pathname.match(/^\/hybrid\/events\/([^/]+)\/checkout$/);
  if (checkoutMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await checkOut(env, {
      projectId: auth.projectId, hybridEventId: decodeURIComponent(checkoutMatch[1]),
      userId: auth.userId,
    });
    return json({ ok });
  }

  const statsMatch = url.pathname.match(/^\/hybrid\/events\/([^/]+)\/stats$/);
  if (statsMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getHybridStats(env, {
      projectId: auth.projectId, hybridEventId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  return null;
}
