/**
 * P20-F: On-Call Collaboration HTTP Routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createSchedule, getSchedule, listSchedules, deleteSchedule,
  createShift, getCurrentOnCall, listShifts, swapShifts, getOnCallHistory,
} from "../lib/oncall-collaboration.js";

export async function dispatchOnCallRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth || !hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }
  async function anyAuth() { return verifyJwtAndGetContext(request, env).catch(() => null); }

  /* Schedules */
  if (url.pathname === "/oncall/schedules" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.roomId) return json({ error: "name and roomId required" }, { status: 400 });
    const sch = await createSchedule(env, {
      projectId: auth.projectId, roomId: body.roomId, name: body.name,
      description: body.description, rotationHours: body.rotationHours,
      escalationMinutes: body.escalationMinutes,
    });
    return json(sch, { status: 201 });
  }

  if (url.pathname === "/oncall/schedules" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const schs = await listSchedules(env, { projectId: auth.projectId, roomId: params.roomId });
    return json({ schedules: schs, count: schs.length });
  }

  const schMatch = url.pathname.match(/^\/oncall\/schedules\/([^/]+)$/);
  if (schMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const sch = await getSchedule(env, { projectId: auth.projectId, scheduleId: decodeURIComponent(schMatch[1]) });
    if (!sch) return json({ error: "not_found" }, { status: 404 });
    return json(sch);
  }
  if (schMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await deleteSchedule(env, { projectId: auth.projectId, scheduleId: decodeURIComponent(schMatch[1]) });
    return json({ ok });
  }

  /* Shifts */
  if (url.pathname === "/oncall/shifts" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.scheduleId || !body?.userId || !body?.startAt || !body?.endAt) {
      return json({ error: "scheduleId, userId, startAt, endAt required" }, { status: 400 });
    }
    const shift = await createShift(env, {
      projectId: auth.projectId, scheduleId: body.scheduleId,
      userId: body.userId, startAt: body.startAt, endAt: body.endAt,
    });
    return json(shift, { status: 201 });
  }

  if (url.pathname === "/oncall/shifts" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const shifts = await listShifts(env, {
      projectId: auth.projectId, scheduleId: params.scheduleId, userId: params.userId,
    });
    return json({ shifts, count: shifts.length });
  }

  const oncallMatch = url.pathname.match(/^\/oncall\/schedules\/([^/]+)\/current$/);
  if (oncallMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const current = await getCurrentOnCall(env, {
      projectId: auth.projectId, scheduleId: decodeURIComponent(oncallMatch[1]),
    });
    return json(current || { onCall: null });
  }

  const historyMatch = url.pathname.match(/^\/oncall\/schedules\/([^/]+)\/history$/);
  if (historyMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const history = await getOnCallHistory(env, {
      projectId: auth.projectId, scheduleId: decodeURIComponent(historyMatch[1]),
      limit: params.limit ? parseInt(params.limit) : 20,
    });
    return json({ history, count: history.length });
  }

  if (url.pathname === "/oncall/shifts/swap" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.shiftIdA || !body?.shiftIdB) return json({ error: "shiftIdA and shiftIdB required" }, { status: 400 });
    const result = await swapShifts(env, {
      projectId: auth.projectId, shiftIdA: body.shiftIdA, shiftIdB: body.shiftIdB,
      userIdA: body.userIdA, userIdB: body.userIdB,
    });
    return json(result);
  }

  return null;
}
