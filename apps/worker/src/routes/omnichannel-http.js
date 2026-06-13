import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  canManageChannels,
  canViewInbox,
  listChannelConfigs,
  getChannelConfig,
  createChannelConfig,
  updateChannelConfig,
  deleteChannelConfig,
  listRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  resolveRouting,
  linkThread,
  getThreadLinks,
  getUnifiedInbox,
} from "../lib/omnichannel.js";

export async function dispatchOmnichannelRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  const configMatch = url.pathname.match(/^\/omnichannel\/configs$/);
  const configIdMatch = url.pathname.match(/^\/omnichannel\/configs\/([^/]+)$/);
  const rulesMatch = url.pathname.match(/^\/omnichannel\/rules$/);
  const ruleIdMatch = url.pathname.match(/^\/omnichannel\/rules\/([^/]+)$/);
  const resolveMatch = url.pathname.match(/^\/omnichannel\/resolve$/);
  const threadLinkMatch = url.pathname.match(/^\/rooms\/([^/]+)\/channel-links$/);
  const inboxMatch = url.pathname.match(/^\/omnichannel\/inbox$/);

  if (!configMatch && !configIdMatch && !rulesMatch && !ruleIdMatch && !resolveMatch && !threadLinkMatch && !inboxMatch) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    /* ── GET /omnichannel/configs ── */
    if (configMatch && request.method === "GET") {
      const configs = await listChannelConfigs(env.DB, { projectId: auth.projectId });
      return json({ configs }, { headers: corsHeaders });
    }

    /* ── POST /omnichannel/configs ── */
    if (configMatch && request.method === "POST") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await createChannelConfig(env.DB, {
        projectId: auth.projectId,
        channelType: body?.channelType,
        channelName: body?.channelName,
        settings: body?.settings,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── GET /omnichannel/configs/:id ── */
    if (configIdMatch && request.method === "GET") {
      const config = await getChannelConfig(env.DB, { projectId: auth.projectId, configId: configIdMatch[1] });
      if (!config) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json({ config }, { headers: corsHeaders });
    }

    /* ── PATCH /omnichannel/configs/:id ── */
    if (configIdMatch && request.method === "PATCH") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await updateChannelConfig(env.DB, {
        projectId: auth.projectId,
        configId: configIdMatch[1],
        channelName: body?.channelName,
        enabled: body?.enabled,
        settings: body?.settings,
      });
      return json(result, { headers: corsHeaders });
    }

    /* ── DELETE /omnichannel/configs/:id ── */
    if (configIdMatch && request.method === "DELETE") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const result = await deleteChannelConfig(env.DB, { projectId: auth.projectId, configId: configIdMatch[1] });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /omnichannel/rules ── */
    if (rulesMatch && request.method === "GET") {
      const channelConfigId = url.searchParams.get("channelConfigId");
      const rules = await listRoutingRules(env.DB, { projectId: auth.projectId, channelConfigId });
      return json({ rules }, { headers: corsHeaders });
    }

    /* ── POST /omnichannel/rules ── */
    if (rulesMatch && request.method === "POST") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await createRoutingRule(env.DB, {
        projectId: auth.projectId,
        channelConfigId: body?.channelConfigId,
        ruleName: body?.ruleName,
        matchPattern: body?.matchPattern,
        targetRoomId: body?.targetRoomId,
        targetRoomPattern: body?.targetRoomPattern,
        priority: body?.priority,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── PATCH /omnichannel/rules/:id ── */
    if (ruleIdMatch && request.method === "PATCH") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await updateRoutingRule(env.DB, {
        projectId: auth.projectId,
        ruleId: ruleIdMatch[1],
        ruleName: body?.ruleName,
        matchPattern: body?.matchPattern,
        targetRoomId: body?.targetRoomId,
        targetRoomPattern: body?.targetRoomPattern,
        priority: body?.priority,
        enabled: body?.enabled,
      });
      return json(result, { headers: corsHeaders });
    }

    /* ── DELETE /omnichannel/rules/:id ── */
    if (ruleIdMatch && request.method === "DELETE") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const result = await deleteRoutingRule(env.DB, { projectId: auth.projectId, ruleId: ruleIdMatch[1] });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /omnichannel/resolve ── */
    if (resolveMatch && request.method === "POST") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await resolveRouting(env.DB, {
        projectId: auth.projectId,
        channelType: body?.channelType,
        senderId: body?.senderId,
        subject: body?.subject,
        body: body?.body,
      });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /rooms/:id/channel-links ── */
    if (threadLinkMatch && request.method === "GET") {
      const roomId = decodeURIComponent(threadLinkMatch[1]);
      if (!isValidId(roomId)) return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const links = await getThreadLinks(env.DB, { projectId: auth.projectId, roomId });
      return json({ links }, { headers: corsHeaders });
    }

    /* ── POST /rooms/:id/channel-links ── */
    if (threadLinkMatch && request.method === "POST") {
      if (!canManageChannels(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const roomId = decodeURIComponent(threadLinkMatch[1]);
      if (!isValidId(roomId)) return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await linkThread(env.DB, {
        projectId: auth.projectId,
        roomId,
        channelType: body?.channelType,
        externalThreadId: body?.externalThreadId,
        externalUserId: body?.externalUserId,
        externalUserName: body?.externalUserName,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── GET /omnichannel/inbox ── */
    if (inboxMatch && request.method === "GET") {
      if (!canViewInbox(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const entries = await getUnifiedInbox(env.DB, { projectId: auth.projectId, userId: auth.userId, limit });
      return json({ entries, count: entries.length }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("omnichannel.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
