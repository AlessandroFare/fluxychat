import { pickRouteDeps } from "./route-http-deps.js";
import { resolveMemberContext } from "../lib/admin-route-context.js";
import {
  initDefaultBadges,
  awardXP,
  getUserProfile,
  getLeaderboard,
  listBadges,
} from "../lib/gamification.js";

export async function dispatchGamificationRoutes(request, url, h) {
  const { json, corsHeaders } = pickRouteDeps(h, ["json", "corsHeaders"]);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId } = ctx;
  const path = url.pathname;

  if (path === "/gamification/init" && request.method === "POST") {
    const result = await initDefaultBadges(env, { projectId });
    return json(result);
  }

  if (path === "/gamification/award" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await awardXP(env, {
      projectId,
      userId: body.userId,
      roomId: body.roomId,
      source: body.source,
      referenceId: body.referenceId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  const profileMatch = path.match(/^\/gamification\/profile\/([^/]+)$/);
  if (profileMatch && request.method === "GET") {
    const result = await getUserProfile(env, { projectId, userId: profileMatch[1] });
    return json(result);
  }

  if (path === "/gamification/leaderboard" && request.method === "GET") {
    const urlObj = new URL(request.url);
    const result = await getLeaderboard(env, {
      projectId,
      roomId: urlObj.searchParams.get("roomId"),
      limit: Number(urlObj.searchParams.get("limit")) || 50,
    });
    return json(result);
  }

  if (path === "/gamification/badges" && request.method === "GET") {
    const result = await listBadges(env, { projectId });
    return json(result);
  }

  return null;
}
