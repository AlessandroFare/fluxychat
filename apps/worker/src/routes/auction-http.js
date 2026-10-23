import { json } from "../lib/http-json.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  createLot,
  startLot,
  getLot,
  getLotsByRoom,
  placeBid,
  extendLot,
  closeLot,
  getBidsForLot,
  watchLot,
  unwatchLot,
  getWatchers,
  getAuctionStats,
} from "../lib/live-auctions.js";

export async function dispatchAuctionRoutes(request, url, h) {
  const path = url.pathname;

  if (!/^\/rooms\/[^/]+\/auction\//.test(path)) return null;

  // Audit F-18: this dispatcher was unauthenticated and trusted h.projectId
  // (an untrusted default) for every query, and passed h.userId (which does
  // not exist) to placeBid. Bind tenant + user from the verified JWT and
  // require room access in that project.
  const auth = await h.verifyJwtAndGetContext?.(request, h.env).catch(() => null);
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: h.corsHeaders ?? {} });
  }
  if (!h.hasAnyRole(auth.roles, ["owner", "admin", "member", "guest"])) {
    return new Response("Forbidden", { status: 403, headers: h.corsHeaders ?? {} });
  }
  const isAdmin = h.hasAnyRole(auth.roles, ["owner", "admin"]);
  const projectId = auth.projectId;
  const roomId = path.split("/")[2];
  const requireRoomAccess = async () =>
    (await canAccessRoom(h.env, auth, roomId))
      ? null
      : json({ error: "not_found" }, h, 404);
  const requireAdmin = () => (isAdmin ? null : json({ error: "forbidden" }, h, 403));
  const loadScopedLot = async (lotId) => getLot(h.env, lotId, projectId);

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots$/)) {
    const denied = requireAdmin() ?? (await requireRoomAccess());
    if (denied) return denied;
    const body = await request.json();
    const result = await createLot(h.env, {
      projectId,
      roomId,
      title: body.title,
      description: body.description,
      startingPrice: body.startingPrice,
      reservePrice: body.reservePrice,
      bidIncrement: body.bidIncrement,
      startAt: body.startAt,
      endAt: body.endAt,
    });
    if (result.error) return json(result, h, 400);
    return json(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const status = url.searchParams.get("status") || undefined;
    const lots = await getLotsByRoom(h.env, { roomId, status, projectId });
    return json({ lots }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const id = path.split("/")[5];
    const lot = await loadScopedLot(id);
    if (!lot) return json({ error: "not_found" }, h, 404);
    return json({ lot }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/start$/)) {
    const denied = requireAdmin() ?? (await requireRoomAccess());
    if (denied) return denied;
    const id = path.split("/")[5];
    if (!(await loadScopedLot(id))) return json({ error: "not_found" }, h, 404);
    const result = await startLot(h.env, { id });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/bid$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const lotId = path.split("/")[5];
    if (!(await loadScopedLot(lotId))) return json({ error: "not_found" }, h, 404);
    const body = await request.json();
    const result = await placeBid(h.env, { lotId, userId: auth.userId, amount: body.amount });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/extend$/)) {
    const denied = requireAdmin() ?? (await requireRoomAccess());
    if (denied) return denied;
    const id = path.split("/")[5];
    if (!(await loadScopedLot(id))) return json({ error: "not_found" }, h, 404);
    const body = await request.json().catch(() => ({}));
    const result = await extendLot(h.env, { id, extendBySeconds: body.extendBySeconds || 30 });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/close$/)) {
    const denied = requireAdmin() ?? (await requireRoomAccess());
    if (denied) return denied;
    const id = path.split("/")[5];
    if (!(await loadScopedLot(id))) return json({ error: "not_found" }, h, 404);
    const body = await request.json().catch(() => ({}));
    const result = await closeLot(h.env, { id, soldTo: body.soldTo });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/bids$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const lotId = path.split("/")[5];
    if (!(await loadScopedLot(lotId))) return json({ error: "not_found" }, h, 404);
    const bids = await getBidsForLot(h.env, { lotId });
    return json({ bids }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watch$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const lotId = path.split("/")[5];
    if (!(await loadScopedLot(lotId))) return json({ error: "not_found" }, h, 404);
    const result = await watchLot(h.env, { lotId, userId: auth.userId, projectId });
    return json(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watch$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const lotId = path.split("/")[5];
    if (!(await loadScopedLot(lotId))) return json({ error: "not_found" }, h, 404);
    const result = await unwatchLot(h.env, { lotId, userId: auth.userId });
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watchers$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const lotId = path.split("/")[5];
    if (!(await loadScopedLot(lotId))) return json({ error: "not_found" }, h, 404);
    const watchers = await getWatchers(h.env, { lotId });
    return json({ watchers }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/stats$/)) {
    const denied = await requireRoomAccess();
    if (denied) return denied;
    const stats = await getAuctionStats(h.env, { roomId, projectId });
    return json({ stats }, h);
  }

  return null;
}
