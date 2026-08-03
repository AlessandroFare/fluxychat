import { pickRouteDeps } from "./route-http-deps.js";
import {
  approveCommitment,
  counterCommitment,
  createCrossOrgRoom,
  getCrossOrgRoom,
  listCommitments,
  listCrossOrgRooms,
  proposeCommitment,
  registerCrossOrgAgent,
} from "../lib/cross-org-rooms.js";
import {
  listCrossOrgAuditLog,
  verifyCrossOrgAuditChain,
} from "../lib/cross-org-audit.js";

export async function dispatchCrossOrgRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/cross-org")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
    "writeAuditEvent",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const adminOnly = !hasAnyRole(auth.roles, ["owner", "admin", "moderator"]);

  try {
    if (request.method === "GET" && path === "/cross-org/rooms") {
      const rooms = await listCrossOrgRooms(env, auth.projectId);
      return json({ ok: true, rooms }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/cross-org/rooms") {
      if (adminOnly) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => ({}));
      const result = await createCrossOrgRoom(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        name: body.name,
        orgAId: body.orgAId,
        orgBId: body.orgBId,
        orgAAgentId: body.orgAAgentId,
        orgBAgentId: body.orgBAgentId,
        maxRounds: body.maxRounds,
        roomId: body.roomId,
      });
      if (!result.ok) return json({ error: result.reason }, { status: 400, headers: corsHeaders });
      await writeAuditEvent(env, {
        projectId: auth.projectId,
        actorUserId: auth.userId,
        action: "cross_org.room.create",
        targetType: "cross_org_room",
        targetId: result.room.id,
      }).catch(() => {});
      return json(result, { headers: corsHeaders });
    }

    const roomMatch = path.match(/^\/cross-org\/rooms\/([^/]+)$/);
    if (roomMatch && request.method === "GET") {
      const room = await getCrossOrgRoom(env, auth.projectId, decodeURIComponent(roomMatch[1]));
      if (!room) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json({ ok: true, room }, { headers: corsHeaders });
    }

    const agentsMatch = path.match(/^\/cross-org\/rooms\/([^/]+)\/agents$/);
    if (agentsMatch && request.method === "POST") {
      const crossOrgRoomId = decodeURIComponent(agentsMatch[1]);
      const body = await request.json().catch(() => ({}));
      const result = await registerCrossOrgAgent(env, {
        projectId: auth.projectId,
        crossOrgRoomId,
        orgId: body.orgId,
        agentId: body.agentId,
        publicKeyB64: body.publicKeyB64,
        capabilities: body.capabilities,
        card: body.card ?? {},
      });
      if (!result.ok) return json({ error: result.reason }, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    const commitmentsListMatch = path.match(/^\/cross-org\/rooms\/([^/]+)\/commitments$/);
    if (commitmentsListMatch && request.method === "GET") {
      const crossOrgRoomId = decodeURIComponent(commitmentsListMatch[1]);
      const commitments = await listCommitments(env, auth.projectId, crossOrgRoomId);
      return json({ ok: true, commitments }, { headers: corsHeaders });
    }

    if (commitmentsListMatch && request.method === "POST") {
      const crossOrgRoomId = decodeURIComponent(commitmentsListMatch[1]);
      const body = await request.json().catch(() => ({}));
      const result = await proposeCommitment(env, {
        projectId: auth.projectId,
        crossOrgRoomId,
        proposedByOrg: body.proposedByOrg,
        proposedByAgent: body.proposedByAgent,
        terms: body.terms,
        ttlSeconds: body.ttlSeconds,
      });
      if (!result.ok) return json({ error: result.reason }, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    const auditMatch = path.match(/^\/cross-org\/rooms\/([^/]+)\/audit$/);
    if (auditMatch && request.method === "GET") {
      const crossOrgRoomId = decodeURIComponent(auditMatch[1]);
      const verify = url.searchParams.get("verify") === "true";
      if (verify) {
        const result = await verifyCrossOrgAuditChain(env, {
          crossOrgRoomId,
          projectId: auth.projectId,
        });
        return json(result, { headers: corsHeaders });
      }
      const entries = await listCrossOrgAuditLog(env, {
        crossOrgRoomId,
        projectId: auth.projectId,
        limit: Number(url.searchParams.get("limit") || 200),
      });
      return json({ ok: true, entries }, { headers: corsHeaders });
    }

    const counterMatch = path.match(/^\/cross-org\/commitments\/([^/]+)\/counter$/);
    if (counterMatch && request.method === "POST") {
      const commitmentId = decodeURIComponent(counterMatch[1]);
      const body = await request.json().catch(() => ({}));
      const result = await counterCommitment(env, {
        projectId: auth.projectId,
        commitmentId,
        counterByOrg: body.counterByOrg,
        terms: body.terms,
        proposedByAgent: body.proposedByAgent,
      });
      if (!result.ok) {
        const status = result.reason === "max_rounds_exceeded" ? 409 : 400;
        return json({ error: result.reason, ...result }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    const approveMatch = path.match(/^\/cross-org\/commitments\/([^/]+)\/approve$/);
    if (approveMatch && request.method === "POST") {
      const commitmentId = decodeURIComponent(approveMatch[1]);
      const body = await request.json().catch(() => ({}));
      if (!body.orgId) return json({ error: "orgId required" }, { status: 400, headers: corsHeaders });
      const result = await approveCommitment(env, {
        projectId: auth.projectId,
        commitmentId,
        orgId: body.orgId,
        userId: auth.userId,
      });
      if (!result.ok) return json({ error: result.reason, state: result.state }, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  } catch (err) {
    logError("cross_org.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
