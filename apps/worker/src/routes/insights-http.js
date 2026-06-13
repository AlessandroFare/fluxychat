import { resolveMemberContext } from "../lib/admin-route-context.js";
import { rolesInclude } from "../lib/route-jwt-auth.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  recordInsight,
  recordInsightsBatch,
  getLatestInsights,
  getInsightSummary,
  getInsightTimeSeries,
  computeEngagementScore,
  subscribeToInsights,
  getInsightSubscriptions,
  unsubscribeFromInsights,
  cleanupOldInsights,
} from "../lib/room-insights.js";

export async function dispatchInsightsRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.includes("/insights")) return null;

  const { hasAnyRole } = pickRouteDeps(h, ["hasAnyRole"]);
  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;
  const isAdmin = rolesInclude(ctx.auth, hasAnyRole, ["owner", "admin"]);

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/insights$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await recordInsight(env, {
      projectId,
      roomId,
      insightType: body.insightType,
      metricName: body.metricName,
      metricValue: body.metricValue,
      metadata: body.metadata,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/insights\/batch$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await recordInsightsBatch(env, {
      projectId,
      roomId,
      insights: body.insights || [],
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/insights$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const insights = await getLatestInsights(env, { roomId, insightType: type, limit });
    return respond({ insights }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/insights\/summary$/)) {
    const roomId = path.split("/")[2];
    const since = url.searchParams.get("since") || undefined;
    const summary = await getInsightSummary(env, { roomId, since });
    return respond({ summary }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/insights\/timeseries\/[^/]+$/)) {
    const parts = path.split("/");
    const roomId = parts[2];
    const metricName = parts[5];
    const since = url.searchParams.get("since") || undefined;
    const until = url.searchParams.get("until") || undefined;
    const series = await getInsightTimeSeries(env, { roomId, metricName, since, until });
    return respond({ series }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/insights\/engagement$/)) {
    const roomId = path.split("/")[2];
    const engagement = await computeEngagementScore(env, { roomId });
    return respond({ engagement }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/insights\/subscribe$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await subscribeToInsights(env, {
      projectId,
      roomId,
      userId,
      insightTypes: body.insightTypes,
      intervalSeconds: body.intervalSeconds,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/insights\/subscriptions$/)) {
    const roomId = path.split("/")[2];
    const subscriptions = await getInsightSubscriptions(env, { roomId });
    return respond({ subscriptions }, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/insights\/subscriptions\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await unsubscribeFromInsights(env, { id });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/insights\/cleanup$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const roomId = path.split("/")[2];
    const body = await request.json().catch(() => ({}));
    const result = await cleanupOldInsights(env, { roomId, olderThanHours: body.olderThanHours || 168 });
    return respond(result, h);
  }

  return null;
}
