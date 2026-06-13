import { describe, it, expect } from "vitest";
import {
  isValidObjectState,
  createObject,
  updateObject,
  getObject,
  getObjectsByRoom,
  deleteObject,
  recordEvent,
  getEvents,
  subscribeToObjectEvents,
  getSubscriptions,
  unsubscribeFromObjectEvents,
  getObjectStats,
} from "./business-objects.js";

function makeEnv() {
  const store = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("SELECT * FROM business_objects WHERE id")) {
              return store.find((r) => r.__table === "objects" && r.id === params[0]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY")) {
              const counts = {};
              for (const r of store.filter((r) => r.__table === "objects" && r.room_id === params[0])) {
                const key = `${r.object_type}|${r.state}`;
                counts[key] = (counts[key] || 0) + 1;
              }
              return { results: Object.entries(counts).map(([k, v]) => { const [t, s] = k.split("|"); return { object_type: t, state: s, count: v }; }) };
            }
            const isEvents = sql.includes("business_object_events");
            let filtered = store.filter((r) => r.room_id === params[0] && r.__table === (isEvents ? "events" : "objects"));
            if (sql.includes("object_type = ?")) filtered = filtered.filter((r) => r.object_type === params[1]);
            if (sql.includes("state = ?")) filtered = filtered.filter((r) => r.state === params[params.length - 2]);
            return { results: filtered.slice(0, 50) };
          },
          run: async () => {
            if (sql.includes("INSERT INTO business_objects")) {
              store.push({ __table: "objects", id: params[0], project_id: params[1], room_id: params[2], object_type: params[3], object_id: params[4], state: params[5], payload_json: params[6], version: Number(params[7]), created_by: params[8], created_at: params[9], updated_at: params[10] });
            } else if (sql.includes("INSERT INTO business_object_events")) {
              store.push({ __table: "events", id: store.filter((r) => r.__table === "events").length + 1, project_id: params[0], room_id: params[1], object_id: params[2], event_type: params[3], payload_json: params[4], actor_user_id: params[5], version: params[6], created_at: params[7] });
            } else if (sql.includes("INSERT INTO business_object_subscriptions")) {
              store.push({ __table: "subs", id: params[0], project_id: params[1], room_id: params[2], user_id: params[3], object_type: params[4], event_types_json: params[5], enabled: params[6], created_at: params[7] });
            } else if (sql.includes("UPDATE business_objects")) {
              const idx = store.findIndex((r) => r.__table === "objects" && r.id === params[4]);
              if (idx >= 0) {
                store[idx].state = params[0];
                store[idx].payload_json = params[1];
                store[idx].version = Number(params[2]);
                store[idx].updated_at = params[3];
              }
            } else if (sql.includes("DELETE FROM business_object")) {
              const before = store.length;
              if (sql.includes("WHERE id = ?")) {
                const idx = store.findIndex((r) => r.id === params[0]);
                if (idx >= 0) store.splice(idx, 1);
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

describe("business-objects", () => {
  describe("isValidObjectState", () => {
    it("accepts valid states", () => {
      expect(isValidObjectState("active")).toBe(true);
      expect(isValidObjectState("resolved")).toBe(true);
      expect(isValidObjectState("pending")).toBe(true);
      expect(isValidObjectState("in_progress")).toBe(true);
    });
    it("rejects invalid states", () => {
      expect(isValidObjectState("invalid")).toBe(false);
    });
  });

  describe("createObject", () => {
    it("creates a ticket object", async () => {
      const env = makeEnv();
      const result = await createObject(env, {
        projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001",
        payload: { title: "Bug report", priority: "high" }, createdBy: "u1",
      });
      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("updateObject", () => {
    it("updates object state and payload", async () => {
      const env = makeEnv();
      const created = await createObject(env, {
        projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001",
        payload: { title: "Bug" }, createdBy: "u1",
      });
      const result = await updateObject(env, { id: created.id, state: "resolved", payload: { title: "Bug", resolved: true }, actorUserId: "u1" });
      expect(result.updated).toBe(true);
      expect(typeof result.version).toBe("number");
    });

    it("returns not_found for nonexistent", async () => {
      const env = makeEnv();
      const result = await updateObject(env, { id: "nonexistent", state: "resolved" });
      expect(result.error).toBe("not_found");
    });
  });

  describe("getObject", () => {
    it("returns object by id", async () => {
      const env = makeEnv();
      const created = await createObject(env, {
        projectId: "p1", roomId: "r1", objectType: "order", objectId: "O-001",
        payload: { total: 99.99 },
      });
      const obj = await getObject(env, created.id);
      expect(obj).toBeDefined();
      expect(obj.objectType).toBe("order");
    });

    it("returns null for nonexistent", async () => {
      const env = makeEnv();
      const obj = await getObject(env, "nonexistent");
      expect(obj).toBeNull();
    });
  });

  describe("getObjectsByRoom", () => {
    it("returns objects for a room", async () => {
      const env = makeEnv();
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001", payload: {} });
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "order", objectId: "O-001", payload: {} });
      const objects = await getObjectsByRoom(env, { roomId: "r1" });
      expect(objects.length).toBe(2);
    });

    it("filters by type", async () => {
      const env = makeEnv();
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001", payload: {} });
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "order", objectId: "O-001", payload: {} });
      const tickets = await getObjectsByRoom(env, { roomId: "r1", objectType: "ticket" });
      expect(tickets.length).toBe(1);
      expect(tickets[0].objectType).toBe("ticket");
    });
  });

  describe("deleteObject", () => {
    it("deletes object and events", async () => {
      const env = makeEnv();
      const created = await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001", payload: {} });
      const result = await deleteObject(env, { id: created.id });
      expect(result.deleted).toBe(true);
      const obj = await getObject(env, created.id);
      expect(obj).toBeNull();
    });
  });

  describe("getEvents", () => {
    it("returns events for a room", async () => {
      const env = makeEnv();
      const created = await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001", payload: {} });
      await recordEvent(env, { projectId: "p1", roomId: "r1", objectId: created.id, eventType: "comment", payload: { text: "hello" }, version: 1 });
      const events = await getEvents(env, { roomId: "r1", objectId: created.id });
      expect(events.length).toBe(2); // created + comment
    });
  });

  describe("getObjectStats", () => {
    it("counts objects by type and state", async () => {
      const env = makeEnv();
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-001", payload: {} });
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "ticket", objectId: "T-002", payload: {} });
      await createObject(env, { projectId: "p1", roomId: "r1", objectType: "order", objectId: "O-001", payload: {} });
      const stats = await getObjectStats(env, { roomId: "r1" });
      expect(stats.ticket.active).toBe(2);
      expect(stats.order.active).toBe(1);
    });
  });

  describe("subscribeToObjectEvents", () => {
    it("creates a subscription", async () => {
      const env = makeEnv();
      const result = await subscribeToObjectEvents(env, {
        projectId: "p1", roomId: "r1", userId: "u1", objectType: "ticket",
      });
      expect(result.created).toBe(true);
    });
  });
});
