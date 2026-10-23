import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createBridgeConfig, updateBridgeConfig, connectBridge, disconnectBridge, getBridgeConfig, listBridgeConfigs, deleteBridgeConfig,
  createChannelMapping, listChannelMappings, deleteChannelMapping,
  syncInboundMessage, syncOutboundMessage, recordBridgeEvent, getBridgeStats,
} from "../lib/bridge.js";

export async function dispatchBridgeRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/bridges")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  async function requireBridge(bridgeId) {
    const bridge = await getBridgeConfig(env, { bridgeId });
    if (!bridge || bridge.projectId !== projectId) {
      return { error: respond({ error: "not_found" }, h, 404) };
    }
    return { bridge };
  }

  if (request.method === "POST" && path === "/admin/bridges") {
    const body = await request.json();
    const result = await createBridgeConfig(env, {
      projectId,
      platform: body.platform,
      name: body.name,
      token: body.token,
      webhookUrl: body.webhookUrl,
      botUserId: body.botUserId,
      botDisplayName: body.botDisplayName,
      settings: body.settings,
      signingSecret: body.signingSecret,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/bridges") {
    const platform = url.searchParams.get("platform");
    const bridges = await listBridgeConfigs(env, { projectId, platform });
    return respond({ bridges }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/bridges\/[^/]+$/)) {
    const bridgeId = path.split("/").pop();
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const mappings = await listChannelMappings(env, { bridgeId });
    return respond({ bridge: gate.bridge, mappings }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/bridges\/[^/]+\/connect$/)) {
    const bridgeId = path.split("/")[3];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await connectBridge(env, { bridgeId });
    await recordBridgeEvent(env, { bridgeId, projectId, eventType: "connect" });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/bridges\/[^/]+\/disconnect$/)) {
    const bridgeId = path.split("/")[3];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await disconnectBridge(env, { bridgeId });
    await recordBridgeEvent(env, { bridgeId, projectId, eventType: "disconnect" });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/bridges\/[^/]+$/)) {
    const bridgeId = path.split("/").pop();
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await deleteBridgeConfig(env, { bridgeId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/bridges/mappings") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await createChannelMapping(env, {
      bridgeId: body.bridgeId,
      projectId,
      fluxychatRoomId: body.roomId,
      externalChannelId: body.externalChannelId,
      externalChannelName: body.externalChannelName,
      syncDirection: body.syncDirection,
      syncReactions: body.syncReactions,
      syncAttachments: body.syncAttachments,
      autoReply: body.autoReply,
    });
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/bridges\/mappings\/[^/]+$/)) {
    const mappingId = path.split("/").pop();
    const result = await deleteChannelMapping(env, { mappingId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/bridges/sync/inbound") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await syncInboundMessage(env, {
      bridgeId: body.bridgeId,
      projectId,
      externalMessageId: body.externalMessageId,
      externalChannelId: body.externalChannelId,
      externalUserId: body.externalUserId,
      externalUsername: body.externalUsername,
      content: body.content,
      timestamp: body.timestamp,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/bridges/sync/outbound") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await syncOutboundMessage(env, {
      bridgeId: body.bridgeId,
      projectId,
      fluxychatMessageId: body.fluxychatMessageId,
      externalChannelId: body.externalChannelId,
      content: body.content,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/bridges\/[^/]+$/)) {
    const bridgeId = path.split("/")[3];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const body = await request.json();
    const result = await updateBridgeConfig(env, {
      bridgeId,
      name: body.name,
      token: body.token,
      signingSecret: body.signingSecret,
      webhookUrl: body.webhookUrl,
      botUserId: body.botUserId,
      botDisplayName: body.botDisplayName,
    });
    return respond(result, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/bridges\/[^/]+\/deliveries$/)) {
    const bridgeId = path.split("/")[3];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const rows = await env.DB.prepare(
      "SELECT id, fluxychat_message_id, external_channel_id, status, attempt_count, last_http_status, last_error, delivered_at, created_at, updated_at FROM bridge_deliveries WHERE bridge_id = ? ORDER BY created_at DESC LIMIT 20"
    )
      .bind(bridgeId)
      .all();
    const deliveries = (rows.results || []).map((r) => ({
      id: r.id,
      fluxychatMessageId: r.fluxychat_message_id,
      externalChannelId: r.external_channel_id,
      status: r.status,
      attemptCount: r.attempt_count,
      lastHttpStatus: r.last_http_status,
      lastError: r.last_error,
      deliveredAt: r.delivered_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return respond({ deliveries }, h);
  }

  if (request.method === "GET" && path === "/admin/bridges/stats") {
    const stats = await getBridgeStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
