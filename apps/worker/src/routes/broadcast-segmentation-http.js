/**
 * P20-E: Broadcast Segmentation HTTP Routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createSegment, getSegment, listSegments, deleteSegment,
  createCampaign, getCampaign, listCampaigns, sendCampaign, completeCampaign,
  createDelivery, markDelivered, markRead, markFailed,
  listDeliveries, getBroadcastStats,
} from "../lib/broadcast-segmentation.js";

export async function dispatchBroadcastRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  async function anyAuth() { return verifyJwtAndGetContext(request, env).catch(() => null); }

  /* Segments */
  if (url.pathname === "/broadcast/segments" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name required" }, { status: 400 });
    const seg = await createSegment(env, {
      projectId: auth.projectId, name: body.name, description: body.description,
      segmentType: body.segmentType, rules: body.rules,
    });
    return json(seg, { status: 201 });
  }

  if (url.pathname === "/broadcast/segments" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const segs = await listSegments(env, { projectId: auth.projectId });
    return json({ segments: segs, count: segs.length });
  }

  const segMatch = url.pathname.match(/^\/broadcast\/segments\/([^/]+)$/);
  if (segMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const seg = await getSegment(env, { projectId: auth.projectId, segmentId: decodeURIComponent(segMatch[1]) });
    if (!seg) return json({ error: "not_found" }, { status: 404 });
    return json(seg);
  }
  if (segMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await deleteSegment(env, { projectId: auth.projectId, segmentId: decodeURIComponent(segMatch[1]) });
    return json({ ok });
  }

  /* Campaigns */
  if (url.pathname === "/broadcast/campaigns" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.messageTemplate) return json({ error: "name and messageTemplate required" }, { status: 400 });
    const camp = await createCampaign(env, {
      projectId: auth.projectId, segmentId: body.segmentId, name: body.name,
      messageTemplate: body.messageTemplate, channel: body.channel, scheduledAt: body.scheduledAt,
    });
    return json(camp, { status: 201 });
  }

  if (url.pathname === "/broadcast/campaigns" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const camps = await listCampaigns(env, { projectId: auth.projectId, status: params.status });
    return json({ campaigns: camps, count: camps.length });
  }

  const campMatch = url.pathname.match(/^\/broadcast\/campaigns\/([^/]+)$/);
  if (campMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const camp = await getCampaign(env, { projectId: auth.projectId, campaignId: decodeURIComponent(campMatch[1]) });
    if (!camp) return json({ error: "not_found" }, { status: 404 });
    return json(camp);
  }

  const sendMatch = url.pathname.match(/^\/broadcast\/campaigns\/([^/]+)\/send$/);
  if (sendMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const camp = await sendCampaign(env, { projectId: auth.projectId, campaignId: decodeURIComponent(sendMatch[1]) });
    return json(camp);
  }

  /* Deliveries */
  if (url.pathname === "/broadcast/deliveries" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.campaignId || !body?.userId) return json({ error: "campaignId and userId required" }, { status: 400 });
    const del = await createDelivery(env, {
      projectId: auth.projectId, campaignId: body.campaignId,
      userId: body.userId, channel: body.channel,
    });
    return json(del, { status: 201 });
  }

  if (url.pathname === "/broadcast/deliveries" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const dels = await listDeliveries(env, {
      projectId: auth.projectId, campaignId: params.campaignId, status: params.status,
    });
    return json({ deliveries: dels, count: dels.length });
  }

  const delMatch = url.pathname.match(/^\/broadcast\/deliveries\/([^/]+)\/(delivered|read|failed)$/);
  if (delMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const action = delMatch[2];
    const deliveryId = decodeURIComponent(delMatch[1]);
    let ok;
    if (action === "delivered") ok = await markDelivered(env, { projectId: auth.projectId, deliveryId });
    else if (action === "read") ok = await markRead(env, { projectId: auth.projectId, deliveryId });
    else if (action === "failed") {
      const body = await request.json().catch(() => null);
      ok = await markFailed(env, { projectId: auth.projectId, deliveryId, error: body?.error });
    }
    return json({ ok });
  }

  /* Stats */
  const statsMatch = url.pathname.match(/^\/broadcast\/stats\/([^/]+)$/);
  if (statsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getBroadcastStats(env, {
      projectId: auth.projectId, campaignId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  return null;
}
