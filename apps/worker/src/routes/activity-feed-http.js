/**
 * P19-D: Activity Feed HTTP Routes.
 *
 * Feeds:  POST/GET /enterprise/feeds, GET/DELETE /enterprise/feeds/:id
 * Events: POST /enterprise/feeds/:id/events, GET /enterprise/feeds/events
 * Stats:  GET /enterprise/feeds/:id/stats
 * Agg:    GET /enterprise/feeds/aggregate
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createFeed, getFeed, listFeeds, deleteFeed,
  recordEvent, queryEvents, getFeedStats, getAggregatedFeed,
} from "../lib/activity-feed.js";

export async function dispatchActivityFeedRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  if (url.pathname === "/enterprise/feeds" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name required" }, { status: 400 });
    const feed = await createFeed(env, {
      projectId: auth.projectId, name: body.name, feedType: body.feedType,
      roomId: body.roomId, description: body.description, isPublic: body.isPublic,
    });
    return json(feed, { status: 201 });
  }

  if (url.pathname === "/enterprise/feeds" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const feeds = await listFeeds(env, { projectId: auth.projectId });
    return json({ feeds, count: feeds.length });
  }

  if (url.pathname === "/enterprise/feeds/events" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const result = await queryEvents(env, {
      projectId: auth.projectId, feedId: params.feedId, eventType: params.eventType,
      actorId: params.actorId, entityType: params.entityType,
      from: params.from, to: params.to,
      limit: params.limit ? parseInt(params.limit) : 50, cursor: params.cursor,
    });
    return json(result);
  }

  if (url.pathname === "/enterprise/feeds/aggregate" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const feedIds = params.feedIds ? params.feedIds.split(",") : [];
    const events = await getAggregatedFeed(env, {
      projectId: auth.projectId, feedIds, from: params.from, to: params.to,
      limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ events, count: events.length });
  }

  const feedMatch = url.pathname.match(/^\/enterprise\/feeds\/([^/]+)$/);
  if (feedMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const feed = await getFeed(env, { projectId: auth.projectId, feedId: decodeURIComponent(feedMatch[1]) });
    if (!feed) return json({ error: "not_found" }, { status: 404 });
    return json(feed);
  }

  if (feedMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteFeed(env, { projectId: auth.projectId, feedId: decodeURIComponent(feedMatch[1]) });
    return json({ deleted });
  }

  const feedEventsMatch = url.pathname.match(/^\/enterprise\/feeds\/([^/]+)\/events$/);
  if (feedEventsMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.eventType || !body?.action) return json({ error: "eventType and action required" }, { status: 400 });
    const event = await recordEvent(env, {
      projectId: auth.projectId, feedId: decodeURIComponent(feedEventsMatch[1]),
      eventType: body.eventType, actorId: body.actorId || auth.userId,
      actorName: body.actorName, entityType: body.entityType, entityId: body.entityId,
      entityName: body.entityName, action: body.action, metadata: body.metadata,
      timestamp: body.timestamp,
    });
    return json(event, { status: 201 });
  }

  if (feedEventsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const result = await queryEvents(env, {
      projectId: auth.projectId, feedId: decodeURIComponent(feedEventsMatch[1]),
      eventType: params.eventType, from: params.from, to: params.to,
      limit: params.limit ? parseInt(params.limit) : 50, cursor: params.cursor,
    });
    return json(result);
  }

  const statsMatch = url.pathname.match(/^\/enterprise\/feeds\/([^/]+)\/stats$/);
  if (statsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getFeedStats(env, {
      projectId: auth.projectId, feedId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  return null;
}
