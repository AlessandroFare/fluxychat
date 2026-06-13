import { describe, it, expect } from "vitest";
import {
  isValidLotStatus,
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
} from "./live-auctions.js";

function makeEnv() {
  const store = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("SELECT * FROM auction_lots WHERE id")) {
              return store.find((r) => r.__table === "lots" && r.id === params[0]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY")) {
              const counts = {};
              for (const r of store.filter((r) => r.__table === "lots" && r.room_id === params[0])) {
                if (!counts[r.status]) counts[r.status] = { count: 0, total: 0 };
                counts[r.status].count++;
                counts[r.status].total += r.current_price;
              }
              return { results: Object.entries(counts).map(([s, v]) => ({ status: s, count: v.count, total_value: v.total })) };
            }
            if (sql.includes("auction_watchers")) {
              return { results: store.filter((r) => r.__table === "watchers" && r.lot_id === params[0]) };
            }
            if (sql.includes("auction_bids")) {
              return { results: store.filter((r) => r.__table === "bids" && r.lot_id === params[0]).sort((a, b) => b.amount - a.amount).slice(0, params[1] || 50) };
            }
            let filtered = store.filter((r) => r.__table === "lots" && r.room_id === params[0]);
            if (sql.includes("status = ?")) filtered = filtered.filter((r) => r.status === params[1]);
            return { results: filtered };
          },
          run: async () => {
            if (sql.includes("INSERT INTO auction_lots")) {
              store.push({ __table: "lots", id: params[0], project_id: params[1], room_id: params[2], title: params[3], description: params[4], starting_price: params[5], current_price: params[6], reserve_price: params[7], bid_increment: params[8], status: params[9], winner_id: null, start_at: params[10], end_at: params[11], created_at: params[12], updated_at: params[13] });
            } else if (sql.includes("INSERT INTO auction_bids")) {
              store.push({ __table: "bids", id: store.filter((r) => r.__table === "bids").length + 1, project_id: params[0], lot_id: params[1], user_id: params[2], amount: params[3], is_winning: params[4], created_at: params[5] });
            } else if (sql.includes("INSERT INTO auction_watchers")) {
              store.push({ __table: "watchers", id: params[0], project_id: params[1], lot_id: params[2], user_id: params[3], created_at: params[4] });
            } else if (sql.includes("UPDATE auction_lots SET status = 'active'")) {
              const idx = store.findIndex((r) => r.__table === "lots" && r.id === params[2]);
              if (idx >= 0) { store[idx].status = "active"; store[idx].start_at = params[0]; store[idx].updated_at = params[1]; }
            } else if (sql.includes("UPDATE auction_lots SET current_price")) {
              const idx = store.findIndex((r) => r.__table === "lots" && r.id === params[2]);
              if (idx >= 0) { store[idx].current_price = params[0]; store[idx].updated_at = params[1]; }
            } else if (sql.includes("UPDATE auction_lots SET status = ?, winner_id")) {
              const idx = store.findIndex((r) => r.__table === "lots" && r.id === params[3]);
              if (idx >= 0) { store[idx].status = params[0]; store[idx].winner_id = params[1]; store[idx].updated_at = params[2]; }
            } else if (sql.includes("UPDATE auction_lots SET status = 'extended'")) {
              const idx = store.findIndex((r) => r.__table === "lots" && r.id === params[2]);
              if (idx >= 0) { store[idx].status = "extended"; store[idx].end_at = params[0]; store[idx].updated_at = params[1]; }
            } else if (sql.includes("UPDATE auction_bids SET is_winning = 0")) {
              for (const r of store.filter((r) => r.__table === "bids" && r.lot_id === params[0])) r.is_winning = 0;
            } else if (sql.includes("DELETE FROM auction_watchers")) {
              const before = store.length;
              for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].__table === "watchers" && store[i].lot_id === params[0] && store[i].user_id === params[1]) store.splice(i, 1);
              }
              return { meta: { changes: before - store.length } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _store: store,
  };
}

describe("live-auctions", () => {
  describe("isValidLotStatus", () => {
    it("accepts valid statuses", () => {
      expect(isValidLotStatus("pending")).toBe(true);
      expect(isValidLotStatus("active")).toBe(true);
      expect(isValidLotStatus("sold")).toBe(true);
    });
    it("rejects invalid", () => {
      expect(isValidLotStatus("invalid")).toBe(false);
    });
  });

  describe("createLot", () => {
    it("creates a lot", async () => {
      const env = makeEnv();
      const result = await createLot(env, { projectId: "p1", roomId: "r1", title: "Vintage Watch", startingPrice: 100 });
      expect(result.created).toBe(true);
    });
    it("requires title", async () => {
      const env = makeEnv();
      const result = await createLot(env, { projectId: "p1", roomId: "r1" });
      expect(result.error).toContain("title");
    });
  });

  describe("startLot", () => {
    it("starts a pending lot", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item" });
      const result = await startLot(env, { id: created.id });
      expect(result.started).toBe(true);
    });
    it("rejects non-pending lot", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item" });
      await startLot(env, { id: created.id });
      const result = await startLot(env, { id: created.id });
      expect(result.error).toContain("already_started");
    });
  });

  describe("placeBid", () => {
    it("places a valid bid", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item", startingPrice: 100, bidIncrement: 10 });
      await startLot(env, { id: created.id });
      const result = await placeBid(env, { lotId: created.id, userId: "u1", amount: 110 });
      expect(result.bid).toBe(true);
      expect(result.amount).toBe(110);
    });
    it("rejects bid below minimum", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item", startingPrice: 100, bidIncrement: 10 });
      await startLot(env, { id: created.id });
      const result = await placeBid(env, { lotId: created.id, userId: "u1", amount: 105 });
      expect(result.error).toContain("minimum_bid");
    });
  });

  describe("extendLot", () => {
    it("extends an active lot", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item" });
      await startLot(env, { id: created.id });
      const result = await extendLot(env, { id: created.id, extendBySeconds: 60 });
      expect(result.extended).toBe(true);
    });
  });

  describe("closeLot", () => {
    it("closes an active lot as unsold", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item" });
      await startLot(env, { id: created.id });
      const result = await closeLot(env, { id: created.id });
      expect(result.status).toBe("unsold");
    });
    it("closes a lot as sold", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item", startingPrice: 100, bidIncrement: 10 });
      await startLot(env, { id: created.id });
      await placeBid(env, { lotId: created.id, userId: "u1", amount: 110 });
      const result = await closeLot(env, { id: created.id, soldTo: "u1" });
      expect(result.status).toBe("sold");
      expect(result.winnerId).toBe("u1");
    });
  });

  describe("watchLot", () => {
    it("adds a watcher", async () => {
      const env = makeEnv();
      const created = await createLot(env, { projectId: "p1", roomId: "r1", title: "Item" });
      const result = await watchLot(env, { lotId: created.id, userId: "u1", projectId: "p1" });
      expect(result.watching).toBe(true);
    });
  });

  describe("getAuctionStats", () => {
    it("returns stats by status", async () => {
      const env = makeEnv();
      await createLot(env, { projectId: "p1", roomId: "r1", title: "A", startingPrice: 100 });
      await createLot(env, { projectId: "p1", roomId: "r1", title: "B", startingPrice: 200 });
      const stats = await getAuctionStats(env, { roomId: "r1" });
      expect(stats.pending.count).toBe(2);
    });
  });
});
