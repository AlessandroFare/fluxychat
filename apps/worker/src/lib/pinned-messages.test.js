import { describe, it, expect } from "vitest";
import { pinMessage, unpinMessage, listPins, getPinStats } from "./pinned-messages.js";

function createMockDb({ pins = [], messages = [] } = {}) {
  let nextId = 1;
  return {
    pins, messages,
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM room_pins")) {
                let filtered = self.pins.filter((p) => p.project_id === args[0] && p.room_id === args[1]);
                if (sql.includes("rp.category = ?")) {
                  filtered = filtered.filter((p) => p.category === args[2]);
                }
                return { results: filtered.map((p) => ({ ...p, content: "msg", user_id: "u1", created_at: "2026-01-01" })) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("COUNT(*) as cnt") && sql.includes("FROM room_pins")) {
                const cnt = self.pins.filter((p) => p.room_id === args[0] && p.project_id === args[1]).length;
                return { cnt };
              }
              if (sql.includes("COUNT(*) as total")) {
                return { total: self.pins.filter((p) => p.project_id === args[0]).length };
              }
              if (sql.includes("SELECT category, COUNT")) {
                return null;
              }
              if (sql.includes("FROM room_pins WHERE room_id = ? AND message_id = ?")) {
                return self.pins.find((p) => p.room_id === args[0] && p.message_id === args[1]) || null;
              }
              if (sql.includes("FROM messages WHERE id = ?")) {
                return self.messages.find((m) => m.id === args[0] && m.project_id === args[1] && m.room_id === args[2]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO room_pins")) {
                const pin = {
                  id: args[0], project_id: args[1], room_id: args[2], message_id: args[3],
                  pinned_by: args[4], category: args[5], sort_order: args[6], created_at: args[7],
                };
                self.pins.push(pin);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM room_pins")) {
                const before = self.pins.length;
                self.pins = self.pins.filter((p) => p.id !== args[0]);
                return { meta: { changes: before - self.pins.length } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe("pinned-messages", () => {
  describe("pinMessage", () => {
    it("pins a message", async () => {
      const db = createMockDb({ messages: [{ id: 1, project_id: "p1", room_id: "r1" }] });
      const result = await pinMessage({ DB: db, ROOM: { get: () => ({ fetch: async () => ({}) }), idFromName: () => "x" } }, {
        projectId: "p1", roomId: "r1", messageId: 1, pinnedBy: "u1",
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeTruthy();
    });
    it("rejects invalid category", async () => {
      const db = createMockDb({ messages: [{ id: 1, project_id: "p1", room_id: "r1" }] });
      const result = await pinMessage({ DB: db }, {
        projectId: "p1", roomId: "r1", messageId: 1, pinnedBy: "u1", category: "invalid",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_category");
    });
    it("rejects already pinned", async () => {
      const db = createMockDb({
        pins: [{ id: "x", project_id: "p1", room_id: "r1", message_id: 1 }],
        messages: [{ id: 1, project_id: "p1", room_id: "r1" }],
      });
      const result = await pinMessage({ DB: db }, {
        projectId: "p1", roomId: "r1", messageId: 1, pinnedBy: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("already_pinned");
    });
    it("rejects when max pins reached", async () => {
      const pins = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`, project_id: "p1", room_id: "r1", message_id: i + 1,
      }));
      const db = createMockDb({
        pins,
        messages: [{ id: 100, project_id: "p1", room_id: "r1" }],
      });
      const result = await pinMessage({ DB: db, PIN_MAX_PER_ROOM: "10" }, {
        projectId: "p1", roomId: "r1", messageId: 100, pinnedBy: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("max_pins_reached");
    });
    it("rejects missing message", async () => {
      const db = createMockDb({ messages: [] });
      const result = await pinMessage({ DB: db }, {
        projectId: "p1", roomId: "r1", messageId: 999, pinnedBy: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("message_not_found");
    });
    it("rejects missing messageId", async () => {
      const db = createMockDb();
      const result = await pinMessage({ DB: db }, {
        projectId: "p1", roomId: "r1", messageId: null, pinnedBy: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("message_id_required");
    });
  });

  describe("unpinMessage", () => {
    it("unpins a message", async () => {
      const db = createMockDb({
        pins: [{ id: "pin1", project_id: "p1", room_id: "r1", message_id: 1 }],
      });
      const result = await unpinMessage({ DB: db, ROOM: { get: () => ({ fetch: async () => ({}) }), idFromName: () => "x" } }, {
        projectId: "p1", roomId: "r1", messageId: 1,
      });
      expect(result.ok).toBe(true);
      expect(db.pins.length).toBe(0);
    });
    it("rejects not pinned", async () => {
      const db = createMockDb({ pins: [] });
      const result = await unpinMessage({ DB: db }, {
        projectId: "p1", roomId: "r1", messageId: 999,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_pinned");
    });
  });

  describe("listPins", () => {
    it("lists pins for a room", async () => {
      const db = createMockDb({
        pins: [
          { id: "p1", project_id: "p1", room_id: "r1", message_id: 1, category: "decision", sort_order: 0, created_at: "2026-01-01", pinned_by: "u1" },
          { id: "p2", project_id: "p1", room_id: "r1", message_id: 2, category: "info", sort_order: 1, created_at: "2026-01-02", pinned_by: "u2" },
        ],
      });
      const result = await listPins({ DB: db }, { projectId: "p1", roomId: "r1" });
      expect(result.ok).toBe(true);
      expect(result.pins.length).toBe(2);
    });
    it("filters by category", async () => {
      const db = createMockDb({
        pins: [
          { id: "p1", project_id: "p1", room_id: "r1", message_id: 1, category: "decision", sort_order: 0, created_at: "2026-01-01", pinned_by: "u1" },
          { id: "p2", project_id: "p1", room_id: "r1", message_id: 2, category: "info", sort_order: 1, created_at: "2026-01-02", pinned_by: "u2" },
        ],
      });
      const result = await listPins({ DB: db }, { projectId: "p1", roomId: "r1", category: "decision" });
      expect(result.ok).toBe(true);
      expect(result.pins.length).toBe(1);
      expect(result.pins[0].category).toBe("decision");
    });
  });

  describe("getPinStats", () => {
    it("returns stats", async () => {
      const db = createMockDb({
        pins: [
          { id: "p1", project_id: "p1", room_id: "r1", message_id: 1, category: "decision", sort_order: 0, created_at: "", pinned_by: "" },
          { id: "p2", project_id: "p1", room_id: "r1", message_id: 2, category: "info", sort_order: 1, created_at: "", pinned_by: "" },
          { id: "p3", project_id: "p1", room_id: "r2", message_id: 3, category: "decision", sort_order: 0, created_at: "", pinned_by: "" },
        ],
      });
      const result = await getPinStats({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.total).toBe(3);
    });
  });
});
