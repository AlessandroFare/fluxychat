import { json } from "../lib/http-json.js";
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

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await createLot(h.env, {
      projectId: h.projectId,
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
    const roomId = path.split("/")[2];
    const status = url.searchParams.get("status") || undefined;
    const lots = await getLotsByRoom(h.env, { roomId, status });
    return json({ lots }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+$/)) {
    const parts = path.split("/");
    const id = parts[5];
    const lot = await getLot(h.env, id);
    if (!lot) return json({ error: "not_found" }, h, 404);
    return json({ lot }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/start$/)) {
    const parts = path.split("/");
    const id = parts[5];
    const result = await startLot(h.env, { id });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/bid$/)) {
    const parts = path.split("/");
    const lotId = parts[5];
    const body = await request.json();
    const result = await placeBid(h.env, { lotId, userId: h.userId, amount: body.amount });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/extend$/)) {
    const parts = path.split("/");
    const id = parts[5];
    const body = await request.json().catch(() => ({}));
    const result = await extendLot(h.env, { id, extendBySeconds: body.extendBySeconds || 30 });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/close$/)) {
    const parts = path.split("/");
    const id = parts[5];
    const body = await request.json().catch(() => ({}));
    const result = await closeLot(h.env, { id, soldTo: body.soldTo });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/bids$/)) {
    const parts = path.split("/");
    const lotId = parts[5];
    const bids = await getBidsForLot(h.env, { lotId });
    return json({ bids }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watch$/)) {
    const parts = path.split("/");
    const lotId = parts[5];
    const result = await watchLot(h.env, { lotId, userId: h.userId, projectId: h.projectId });
    return json(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watch$/)) {
    const parts = path.split("/");
    const lotId = parts[5];
    const result = await unwatchLot(h.env, { lotId, userId: h.userId });
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/lots\/[^/]+\/watchers$/)) {
    const parts = path.split("/");
    const lotId = parts[5];
    const watchers = await getWatchers(h.env, { lotId });
    return json({ watchers }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/auction\/stats$/)) {
    const roomId = path.split("/")[2];
    const stats = await getAuctionStats(h.env, { roomId });
    return json({ stats }, h);
  }

  return null;
}
