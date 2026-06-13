import { pickRouteDeps } from "./route-http-deps.js";
import { resolveMemberContext } from "../lib/admin-route-context.js";
import {
  generateRoomSummary,
  computeRoomPriorities,
  generateSuggestedResponses,
  getInboxView,
} from "../lib/inbox-zero.js";

export async function dispatchInboxZeroRoutes(request, url, h) {
  const { json, corsHeaders } = pickRouteDeps(h, ["json", "corsHeaders"]);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId, userId } = ctx;
  const path = url.pathname;

  if (path === "/inbox/summarize" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await generateRoomSummary(env, {
      projectId,
      roomId: body.roomId,
      userId: body.userId || userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/inbox/priorities" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await computeRoomPriorities(env, {
      projectId,
      userId: body.userId || userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/inbox/suggest" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await generateSuggestedResponses(env, {
      projectId,
      roomId: body.roomId,
      userId: body.userId || userId,
      count: body.count || 3,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/inbox" && request.method === "GET") {
    const urlObj = new URL(request.url);
    const result = await getInboxView(env, {
      projectId,
      userId: urlObj.searchParams.get("userId") || userId,
    });
    return json(result);
  }

  return null;
}
