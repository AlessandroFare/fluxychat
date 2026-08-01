import { resolveMemberContext } from "../lib/admin-route-context.js";
import { rolesInclude } from "../lib/route-jwt-auth.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createCallSession, startCall, endCall, getCallSession, listActiveCalls,
  joinCall, leaveCall, updateParticipant, listParticipants,
  recordCallEvent, toggleRecording, getCallStats, generateToken,
} from "../lib/video-voice.js";

export async function dispatchVideoVoiceRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/calls")) return null;

  const { hasAnyRole } = pickRouteDeps(h, ["hasAnyRole"]);
  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;
  const isAdmin = rolesInclude(ctx.auth, hasAnyRole, ["owner", "admin", "moderator"]);

  async function requireCall(callId) {
    const call = await getCallSession(env, { callId });
    if (!call || call.project_id !== projectId) {
      return { error: respond({ error: "not_found" }, h, 404) };
    }
    return { call };
  }

  if (request.method === "POST" && path === "/admin/calls") {
    const body = await request.json();
    const result = await createCallSession(env, {
      projectId,
      roomId: body.roomId,
      provider: body.provider,
      startedBy: body.startedBy || userId,
      maxParticipants: body.maxParticipants,
      settings: body.settings,
      recordingEnabled: body.recordingEnabled,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/calls/active") {
    const calls = await listActiveCalls(env, { projectId });
    return respond({ calls }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/calls\/[^/]+$/)) {
    const callId = path.split("/").pop();
    const gate = await requireCall(callId);
    if (gate.error) return gate.error;
    const participants = await listParticipants(env, { callId });
    return respond({ call: gate.call, participants }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/calls\/[^/]+\/start$/)) {
    const callId = path.split("/")[3];
    const gate = await requireCall(callId);
    if (gate.error) return gate.error;
    const result = await startCall(env, { callId });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/calls\/[^/]+\/end$/)) {
    const callId = path.split("/")[3];
    const gate = await requireCall(callId);
    if (gate.error) return gate.error;
    const result = await endCall(env, { callId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/calls/join") {
    const body = await request.json();
    const gate = await requireCall(body.callId);
    if (gate.error) return gate.error;
    const result = await joinCall(env, {
      callId: body.callId,
      userId: body.userId || userId,
      displayName: body.displayName,
      role: body.role,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/calls/leave") {
    const body = await request.json();
    const result = await leaveCall(env, { callId: body.callId, userId: body.userId || userId });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "PATCH" && path === "/admin/calls/participants") {
    const body = await request.json();
    const result = await updateParticipant(env, {
      callId: body.callId,
      userId: body.userId || userId,
      audioEnabled: body.audioEnabled,
      videoEnabled: body.videoEnabled,
      screenSharing: body.screenSharing,
    });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/calls\/[^/]+\/recording$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const callId = path.split("/")[3];
    const gate = await requireCall(callId);
    if (gate.error) return gate.error;
    const body = await request.json();
    const result = await toggleRecording(env, { callId, enabled: body.enabled });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/calls/token") {
    const body = await request.json();
    const token = await generateToken(env, body.provider || "livekit", {
      roomId: body.roomId,
      roomName: body.roomName || body.providerRoomId,
      userId: body.userId || userId,
      displayName: body.displayName,
      ttl: body.ttl,
    });
    return respond({ token }, h);
  }

  if (request.method === "GET" && path === "/admin/calls/stats") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const stats = await getCallStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
