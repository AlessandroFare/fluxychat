import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessAgentQueue } from "../lib/agent-queue.js";
import {
  canManageProfiles,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  buildProfilePrompt,
  assignProfileToRoom,
  getRoomAssignment,
  getProfileForRoom,
  removeRoomAssignment,
  abTestAssign,
  getAbTestResults,
} from "../lib/agent-profiles.js";

export async function dispatchAgentProfilesRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError"]);

  /* ── GET /agent-profiles ── */
  if (url.pathname === "/agent-profiles" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canAccessAgentQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profiles = await listProfiles(env.DB, { projectId: auth.projectId });
    return json({ profiles }, { headers: corsHeaders });
  }

  /* ── POST /agent-profiles ── */
  if (url.pathname === "/agent-profiles" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { name, description, tone, verbosity, followUpStyle, escalationThreshold, policyConstraints, businessObjectives, systemPromptAddendum, abTestWeight } = body || {};
    if (!name) return json({ error: "name required" }, { status: 400, headers: corsHeaders });

    const result = await createProfile(env.DB, { projectId: auth.projectId, name, description, tone, verbosity, followUpStyle, escalationThreshold, policyConstraints, businessObjectives, systemPromptAddendum, abTestWeight });
    if (!result.ok) return json({ error: result.error }, { status: 409, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /agent-profiles/:id ── */
  if (url.pathname.startsWith("/agent-profiles/") && url.pathname !== "/agent-profiles" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canAccessAgentQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profileId = url.pathname.split("/")[2];
    const profile = await getProfile(env.DB, { projectId: auth.projectId, profileId });
    if (!profile) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    return json({ profile }, { headers: corsHeaders });
  }

  /* ── PATCH /agent-profiles/:id ── */
  if (url.pathname.startsWith("/agent-profiles/") && url.pathname !== "/agent-profiles" && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profileId = url.pathname.split("/")[2];
    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const result = await updateProfile(env.DB, { projectId: auth.projectId, profileId, ...body });
    if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  /* ── DELETE /agent-profiles/:id ── */
  if (url.pathname.startsWith("/agent-profiles/") && url.pathname !== "/agent-profiles" && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profileId = url.pathname.split("/")[2];
    const result = await deleteProfile(env.DB, { projectId: auth.projectId, profileId });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /agent-profiles/:id/prompt ── */
  if (url.pathname.match(/^\/agent-profiles\/[^/]+\/prompt$/) && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canAccessAgentQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profileId = url.pathname.split("/")[2];
    const profile = await getProfile(env.DB, { projectId: auth.projectId, profileId });
    if (!profile) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    const prompt = buildProfilePrompt(profile);
    return json({ prompt, profileId, profileName: profile.name }, { headers: corsHeaders });
  }

  /* ── POST /agent-profiles/assign ── */
  if (url.pathname === "/agent-profiles/assign" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { roomId, profileId } = body || {};
    if (!roomId || !profileId) return json({ error: "roomId and profileId required" }, { status: 400, headers: corsHeaders });
    const result = await assignProfileToRoom(env.DB, { projectId: auth.projectId, roomId, profileId });
    if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /agent-profiles/room/:roomId ── */
  if (url.pathname.startsWith("/agent-profiles/room/") && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canAccessAgentQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const roomId = url.pathname.split("/")[3];
    const profile = await getProfileForRoom(env.DB, { projectId: auth.projectId, roomId });
    return json({ profile: profile || null }, { headers: corsHeaders });
  }

  /* ── DELETE /agent-profiles/room/:roomId ── */
  if (url.pathname.startsWith("/agent-profiles/room/") && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const roomId = url.pathname.split("/")[3];
    const result = await removeRoomAssignment(env.DB, { projectId: auth.projectId, roomId });
    return json(result, { headers: corsHeaders });
  }

  /* ── POST /agent-profiles/ab-test ── */
  if (url.pathname === "/agent-profiles/ab-test" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canManageProfiles(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { roomId, profileIds } = body || {};
    if (!roomId || !Array.isArray(profileIds) || profileIds.length === 0) {
      return json({ error: "roomId and profileIds[] required" }, { status: 400, headers: corsHeaders });
    }
    const result = await abTestAssign(env.DB, { projectId: auth.projectId, roomId, profileIds });
    if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /agent-profiles/ab-test/results ── */
  if (url.pathname === "/agent-profiles/ab-test/results" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canAccessAgentQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const profileIds = url.searchParams.getAll("profile_id");
    if (profileIds.length === 0) return json({ error: "profile_id params required" }, { status: 400, headers: corsHeaders });
    const result = await getAbTestResults(env.DB, { projectId: auth.projectId, profileIds });
    return json(result, { headers: corsHeaders });
  }

  return null;
}
