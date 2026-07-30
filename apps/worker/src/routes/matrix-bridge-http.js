import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createMatrixBridge, connectMatrixBridge, disconnectMatrixBridge, getMatrixBridge, listMatrixBridges, deleteMatrixBridge,
  createMatrixRoomMapping, listMatrixRoomMappings, deleteMatrixRoomMapping,
  syncMatrixInbound, syncMatrixOutbound, recordMatrixSyncLog, getMatrixBridgeStats,
} from "../lib/matrix-bridge.js";

export async function dispatchMatrixBridgeRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/matrix")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  async function requireBridge(bridgeId) {
    const bridge = await getMatrixBridge(env, { bridgeId });
    if (!bridge || bridge.projectId !== projectId) {
      return { error: respond({ error: "not_found" }, h, 404) };
    }
    return { bridge };
  }

  if (request.method === "POST" && path === "/admin/matrix/bridges") {
    const body = await request.json();
    const result = await createMatrixBridge(env, {
      projectId,
      homeserverUrl: body.homeserverUrl,
      accessToken: body.accessToken,
      botUserId: body.botUserId,
      botDisplayName: body.botDisplayName,
      syncMode: body.syncMode,
      settings: body.settings,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/matrix/bridges") {
    const bridges = await listMatrixBridges(env, { projectId });
    return respond({ bridges }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/matrix\/bridges\/[^/]+$/)) {
    const bridgeId = path.split("/").pop();
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const mappings = await listMatrixRoomMappings(env, { bridgeId });
    return respond({ bridge: gate.bridge, mappings }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/matrix\/bridges\/[^/]+\/connect$/)) {
    const bridgeId = path.split("/")[4];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await connectMatrixBridge(env, { bridgeId });
    await recordMatrixSyncLog(env, {
      bridgeId,
      projectId,
      eventType: "membership",
      direction: "inbound",
      payload: { action: "connect" },
    });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/matrix\/bridges\/[^/]+\/disconnect$/)) {
    const bridgeId = path.split("/")[4];
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await disconnectMatrixBridge(env, { bridgeId });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/matrix\/bridges\/[^/]+$/)) {
    const bridgeId = path.split("/").pop();
    const gate = await requireBridge(bridgeId);
    if (gate.error) return gate.error;
    const result = await deleteMatrixBridge(env, { bridgeId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/matrix/mappings") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await createMatrixRoomMapping(env, {
      bridgeId: body.bridgeId,
      projectId,
      fluxychatRoomId: body.roomId,
      matrixRoomId: body.matrixRoomId,
      matrixSpaceId: body.matrixSpaceId,
      syncReactions: body.syncReactions,
      syncAttachments: body.syncAttachments,
    });
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/matrix\/mappings\/[^/]+$/)) {
    const mappingId = path.split("/").pop();
    const result = await deleteMatrixRoomMapping(env, { mappingId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/matrix/sync/inbound") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await syncMatrixInbound(env, {
      bridgeId: body.bridgeId,
      projectId,
      matrixEventId: body.matrixEventId,
      matrixRoomId: body.matrixRoomId,
      senderId: body.senderId,
      content: body.content,
      msgtype: body.msgtype,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/matrix/sync/outbound") {
    const body = await request.json();
    const gate = await requireBridge(body.bridgeId);
    if (gate.error) return gate.error;
    const result = await syncMatrixOutbound(env, {
      bridgeId: body.bridgeId,
      projectId,
      fluxychatMessageId: body.fluxychatMessageId,
      matrixRoomId: body.matrixRoomId,
      content: body.content,
      msgtype: body.msgtype,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/matrix/stats") {
    const stats = await getMatrixBridgeStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
