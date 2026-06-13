import { logInfo } from "./worker-log.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_LOT_STATUS = ["pending", "active", "extended", "sold", "unsold"];

export function isValidLotStatus(status) {
  return VALID_LOT_STATUS.includes(status);
}

export async function createLot(env, { projectId, roomId, title, description, startingPrice, reservePrice, bidIncrement, startAt, endAt }) {
  if (!title) return { error: "title is required" };

  const id = `lot_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO auction_lots (id, project_id, room_id, title, description, starting_price, current_price, reserve_price, bid_increment, status, start_at, end_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, projectId, roomId, title, description || null, startingPrice || 0, startingPrice || 0, reservePrice || null, bidIncrement || 1, "pending", startAt || null, endAt || null, now, now)
    .run();

  return { id, created: true };
}

export async function startLot(env, { id }) {
  const lot = await getLot(env, id);
  if (!lot) return { error: "not_found" };
  if (lot.status !== "pending") return { error: "lot_already_started" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE auction_lots SET status = 'active', start_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(now, now, id)
    .run();

  return { id, started: true };
}

export async function getLot(env, id) {
  const row = await env.DB.prepare("SELECT * FROM auction_lots WHERE id = ?").bind(id).first();
  return row ? mapLotRow(row) : null;
}

export async function getLotsByRoom(env, { roomId, status, limit = 50 }) {
  let query = "SELECT * FROM auction_lots WHERE room_id = ?";
  const params = [roomId];

  if (status) { query += " AND status = ?"; params.push(status); }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(mapLotRow);
}

export async function placeBid(env, { lotId, userId, amount }) {
  const lot = await getLot(env, lotId);
  if (!lot) return { error: "not_found" };
  if (lot.status !== "active") return { error: "lot_not_active" };

  const minBid = lot.currentPrice + lot.bidIncrement;
  if (amount < minBid) return { error: `minimum_bid_is_${minBid}` };

  const now = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE auction_bids SET is_winning = 0 WHERE lot_id = ? AND is_winning = 1"
  )
    .bind(lotId)
    .run();

  await env.DB.prepare(
    "INSERT INTO auction_bids (project_id, lot_id, user_id, amount, is_winning, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(lot.projectId, lotId, userId, amount, now)
    .run();

  await env.DB.prepare(
    "UPDATE auction_lots SET current_price = ?, updated_at = ? WHERE id = ?"
  )
    .bind(amount, now, lotId)
    .run();

  return { bid: true, amount, lotId };
}

export async function extendLot(env, { id, extendBySeconds = 30 }) {
  const lot = await getLot(env, id);
  if (!lot) return { error: "not_found" };
  if (lot.status !== "active") return { error: "lot_not_active" };

  const now = new Date();
  const newEnd = new Date(now.getTime() + extendBySeconds * 1000).toISOString();

  await env.DB.prepare(
    "UPDATE auction_lots SET status = 'extended', end_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(newEnd, new Date().toISOString(), id)
    .run();

  return { id, extended: true, newEndAt: newEnd };
}

export async function closeLot(env, { id, soldTo }) {
  const lot = await getLot(env, id);
  if (!lot) return { error: "not_found" };
  if (!["active", "extended"].includes(lot.status)) return { error: "lot_not_closable" };

  const now = new Date().toISOString();
  const sold = soldTo || lot.winnerId;
  const status = sold ? "sold" : "unsold";

  await env.DB.prepare(
    "UPDATE auction_lots SET status = ?, winner_id = ?, updated_at = ? WHERE id = ?"
  )
    .bind(status, sold || null, now, id)
    .run();

  return { id, status, winnerId: sold || null };
}

export async function getBidsForLot(env, { lotId, limit = 50 }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM auction_bids WHERE lot_id = ? ORDER BY amount DESC LIMIT ?"
  )
    .bind(lotId, limit)
    .all();

  return (rows.results || []).map(mapBidRow);
}

export async function watchLot(env, { lotId, userId, projectId }) {
  const id = `aw_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      "INSERT INTO auction_watchers (id, project_id, lot_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(id, projectId, lotId, userId, now)
      .run();
    return { watching: true };
  } catch {
    return { watching: true, alreadyWatching: true };
  }
}

export async function unwatchLot(env, { lotId, userId }) {
  const result = await env.DB.prepare(
    "DELETE FROM auction_watchers WHERE lot_id = ? AND user_id = ?"
  )
    .bind(lotId, userId)
    .run();
  return { removed: result.meta?.changes || 0 };
}

export async function getWatchers(env, { lotId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM auction_watchers WHERE lot_id = ?"
  )
    .bind(lotId)
    .all();

  return (rows.results || []).map((r) => ({ userId: r.user_id, createdAt: r.created_at }));
}

export async function getAuctionStats(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT status, COUNT(*) as count, SUM(current_price) as total_value FROM auction_lots WHERE room_id = ? GROUP BY status"
  )
    .bind(roomId)
    .all();

  const stats = {};
  for (const r of rows.results || []) {
    stats[r.status] = { count: r.count, totalValue: r.total_value || 0 };
  }
  return stats;
}

function mapLotRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    title: row.title,
    description: row.description,
    startingPrice: row.starting_price,
    currentPrice: row.current_price,
    reservePrice: row.reserve_price,
    bidIncrement: row.bid_increment,
    status: row.status,
    winnerId: row.winner_id,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBidRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    lotId: row.lot_id,
    userId: row.user_id,
    amount: row.amount,
    isWinning: row.is_winning === 1,
    createdAt: row.created_at,
  };
}
