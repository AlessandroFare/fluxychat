/**
 * CP competitor parity HTTP routes: user activity feed, canned responses,
 * contacts, business hours, chat→ticket.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  listActivityFeed,
  markActivityFeedRead,
  countUnreadActivity,
} from "../lib/user-activity-feed.js";
import {
  listCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  recordCannedResponseUse,
} from "../lib/canned-responses.js";
import { listContacts, addContact, removeContact, requestContact, listIncomingContactRequests, acceptContactRequest, declineContactRequest, transferGroupOwnership } from "../lib/user-contacts.js";
import {
  getBusinessHours,
  upsertBusinessHours,
  createTicketFromRoom,
} from "../lib/support-vertical.js";
import {
  getPendingCsatForRoom,
  submitCsatResponse,
  maybeTriggerCsatOnRoomEnd,
} from "../lib/support-csat.js";

export async function dispatchCompetitorParityRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
  ]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  // ---------- CP-020: User activity feed ----------

  if (url.pathname === "/user/activity-feed" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const items = await listActivityFeed(env, {
      projectId: a.projectId,
      userId: a.userId,
      limit,
      unreadOnly,
    });
    const unreadCount = await countUnreadActivity(env, a.projectId, a.userId);
    return json({ items, unreadCount });
  }

  if (url.pathname === "/user/activity-feed/read" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => ({}));
    const result = await markActivityFeedRead(env, {
      projectId: a.projectId,
      userId: a.userId,
      ids: body?.ids,
    });
    return json(result);
  }

  // ---------- CP-041: Canned responses ----------

  if (url.pathname === "/support/canned-responses" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const category = url.searchParams.get("category") || undefined;
    const responses = await listCannedResponses(env, {
      projectId: a.projectId,
      category,
    });
    return json({ responses });
  }

  if (url.pathname === "/support/canned-responses" && request.method === "POST") {
    const a = await auth();
    if (!a || !hasAnyRole(a, ["owner", "admin", "agent"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await createCannedResponse(env, {
      projectId: a.projectId,
      shortcut: body?.shortcut,
      title: body?.title,
      body: body?.body,
      category: body?.category,
      createdBy: a.userId,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const cannedIdMatch = url.pathname.match(/^\/support\/canned-responses\/([^/]+)$/);
  if (cannedIdMatch && request.method === "PATCH") {
    const a = await auth();
    if (!a || !hasAnyRole(a, ["owner", "admin", "agent"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await updateCannedResponse(env, {
      projectId: a.projectId,
      id: decodeURIComponent(cannedIdMatch[1]),
      title: body?.title,
      body: body?.body,
      category: body?.category,
    });
    return json(result);
  }

  if (cannedIdMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a || !hasAnyRole(a, ["owner", "admin"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const result = await deleteCannedResponse(env, a.projectId, decodeURIComponent(cannedIdMatch[1]));
    return json(result);
  }

  const cannedUseMatch = url.pathname.match(/^\/support\/canned-responses\/([^/]+)\/use$/);
  if (cannedUseMatch && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    await recordCannedResponseUse(env, a.projectId, decodeURIComponent(cannedUseMatch[1]));
    return json({ ok: true });
  }

  // ---------- CP-043/044: Business hours + chat→ticket ----------

  if (url.pathname === "/support/business-hours" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const hours = await getBusinessHours(env, a.projectId);
    return json(hours);
  }

  if (url.pathname === "/support/business-hours" && request.method === "PUT") {
    const a = await auth();
    if (!a || !hasAnyRole(a, ["owner", "admin"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await upsertBusinessHours(env, {
      projectId: a.projectId,
      timezone: body?.timezone,
      schedule: body?.schedule,
      offlineMessage: body?.offlineMessage,
      enabled: body?.enabled,
    });
    return json(result);
  }

  if (url.pathname === "/support/tickets/from-room" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.roomId) return json({ error: "roomId required" }, { status: 400 });
    const result = await createTicketFromRoom(env, {
      projectId: a.projectId,
      roomId: body.roomId,
      reportedBy: a.userId,
      subject: body.subject,
      messages: body.messages,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  // ---------- CP-042: CSAT post-chat ----------

  if (url.pathname === "/support/csat/pending" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = url.searchParams.get("roomId");
    if (!roomId) return json({ error: "roomId required" }, { status: 400 });
    const result = await getPendingCsatForRoom(env, {
      projectId: a.projectId,
      roomId,
    });
    return json(result);
  }

  if (url.pathname === "/support/csat/trigger" && request.method === "POST") {
    const a = await auth();
    if (!a || !hasAnyRole(a, ["owner", "admin", "agent"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    if (!body?.roomId) return json({ error: "roomId required" }, { status: 400 });
    const result = await maybeTriggerCsatOnRoomEnd(env, {
      projectId: a.projectId,
      roomId: body.roomId,
      userId: a.userId,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const csatRespondMatch = url.pathname.match(/^\/support\/csat\/([^/]+)\/respond$/);
  if (csatRespondMatch && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await submitCsatResponse(env, {
      projectId: a.projectId,
      surveyId: decodeURIComponent(csatRespondMatch[1]),
      rating: body?.rating,
      feedback: body?.feedback,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  // ---------- CP-018: User contacts ----------

  if (url.pathname === "/user/contacts" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const status = url.searchParams.get("status") || "accepted";
    const contacts = await listContacts(env, {
      projectId: a.projectId,
      ownerUserId: a.userId,
      status,
    });
    return json({ contacts });
  }

  if (url.pathname === "/user/contacts" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await addContact(env, {
      projectId: a.projectId,
      ownerUserId: a.userId,
      contactUserId: body?.userId || body?.contactUserId,
      displayName: body?.displayName,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const contactMatch = url.pathname.match(/^\/user\/contacts\/([^/]+)$/);
  if (contactMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    await removeContact(env, a.projectId, a.userId, decodeURIComponent(contactMatch[1]));
    return json({ ok: true });
  }

  // NW-132: Friend requests
  if (url.pathname === "/user/contacts/request" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await requestContact(env, {
      projectId: a.projectId,
      ownerUserId: a.userId,
      contactUserId: body?.userId || body?.contactUserId,
      displayName: body?.displayName,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  if (url.pathname === "/user/contacts/incoming" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const requests = await listIncomingContactRequests(env, {
      projectId: a.projectId,
      userId: a.userId,
    });
    return json({ requests });
  }

  if (url.pathname === "/user/contacts/accept" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await acceptContactRequest(env, {
      projectId: a.projectId,
      ownerUserId: a.userId,
      fromUserId: body?.fromUserId || body?.userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (url.pathname === "/user/contacts/decline" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await declineContactRequest(env, {
      projectId: a.projectId,
      ownerUserId: a.userId,
      fromUserId: body?.fromUserId || body?.userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  const ownershipMatch = url.pathname.match(/^\/rooms\/([^/]+)\/ownership\/transfer$/);
  if (ownershipMatch && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await transferGroupOwnership(env, {
      projectId: a.projectId,
      roomId: decodeURIComponent(ownershipMatch[1]),
      fromUserId: a.userId,
      toUserId: body?.toUserId || body?.userId,
      jwtRoles: a.roles ?? [],
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  return null;
}
