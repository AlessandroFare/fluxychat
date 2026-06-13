import { describe, it, expect, vi } from "vitest";
import {
  isValidPresenceType,
  updatePresence,
  getPresenceByRoom,
  getPresenceByUser,
  getPresenceSnapshot,
  getCursorsByRoom,
  getFocusByRoom,
  clearPresence,
  clearStalePresence,
  getPresenceStats,
} from "./presence-extensions.js";

function makeEnv() {
  const store = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("SELECT id FROM presence")) {
              return store.find(
                (r) => r.room_id === params[0] && r.user_id === params[1] && r.presence_type === params[2]
              ) || null;
            }
            return null;
          },
          all: async () => {
            let filtered = [...store];
            if (sql.includes("GROUP BY")) {
              const counts = {};
              for (const r of filtered) {
                if (!counts[r.presence_type]) counts[r.presence_type] = new Set();
                counts[r.presence_type].add(r.user_id);
              }
              return { results: Object.entries(counts).map(([t, s]) => ({ presence_type: t, user_count: s.size })) };
            }
            if (sql.includes("room_id = ?")) filtered = filtered.filter((r) => r.room_id === params[0]);
            if (sql.includes("presence_type = ?")) filtered = filtered.filter((r) => r.presence_type === params[1]);
            if (sql.includes("user_id = ?")) filtered = filtered.filter((r) => r.user_id === params[0]);
            return { results: filtered };
          },
          run: async () => {
            if (sql.includes("INSERT")) {
              store.push({
                id: params[0],
                project_id: params[1],
                room_id: params[2],
                user_id: params[3],
                presence_type: params[4],
                payload_json: params[5],
                updated_at: params[6],
                expires_at: params[7],
              });
            } else if (sql.includes("UPDATE")) {
              const idx = store.findIndex((r) => r.id === params[3]);
              if (idx >= 0) {
                store[idx].payload_json = params[0];
                store[idx].updated_at = params[1];
                store[idx].expires_at = params[2];
              }
            } else if (sql.includes("DELETE")) {
              const before = store.length;
              if (sql.includes("expires_at <")) {
                const now = params[0];
                for (let i = store.length - 1; i >= 0; i--) {
                  if (store[i].expires_at && store[i].expires_at < now) store.splice(i, 1);
                }
              } else {
                const roomId = params[0];
                const userId = params[1];
                for (let i = store.length - 1; i >= 0; i--) {
                  if (store[i].room_id === roomId && (!userId || store[i].user_id === userId)) store.splice(i, 1);
                }
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

describe("presence-extensions", () => {
  describe("isValidPresenceType", () => {
    it("accepts valid types", () => {
      expect(isValidPresenceType("cursor")).toBe(true);
      expect(isValidPresenceType("focus")).toBe(true);
      expect(isValidPresenceType("scroll")).toBe(true);
      expect(isValidPresenceType("selection")).toBe(true);
      expect(isValidPresenceType("viewing")).toBe(true);
    });

    it("rejects invalid types", () => {
      expect(isValidPresenceType("invalid")).toBe(false);
      expect(isValidPresenceType("")).toBe(false);
    });
  });

  describe("updatePresence", () => {
    it("creates new cursor presence", async () => {
      const env = makeEnv();
      const result = await updatePresence(env, {
        projectId: "p1",
        roomId: "room_1",
        userId: "user_1",
        type: "cursor",
        payload: { x: 100, y: 200 },
      });
      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();
    });

    it("updates existing presence", async () => {
      const env = makeEnv();
      await updatePresence(env, {
        projectId: "p1",
        roomId: "room_1",
        userId: "user_1",
        type: "cursor",
        payload: { x: 100, y: 200 },
      });
      const result = await updatePresence(env, {
        projectId: "p1",
        roomId: "room_1",
        userId: "user_1",
        type: "cursor",
        payload: { x: 150, y: 250 },
      });
      expect(result.updated).toBe(true);
    });

    it("rejects invalid type", async () => {
      const env = makeEnv();
      const result = await updatePresence(env, {
        projectId: "p1",
        roomId: "room_1",
        userId: "user_1",
        type: "invalid",
        payload: {},
      });
      expect(result.error).toContain("must be one of");
    });
  });

  describe("getPresenceByRoom", () => {
    it("returns presence for a room", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 1 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u2", type: "focus", payload: { messageId: "m1" } });
      const presence = await getPresenceByRoom(env, { roomId: "r1" });
      expect(presence.length).toBe(2);
    });

    it("filters by type", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 1 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u2", type: "focus", payload: { messageId: "m1" } });
      const cursors = await getPresenceByRoom(env, { roomId: "r1", type: "cursor" });
      expect(cursors.length).toBe(1);
      expect(cursors[0].type).toBe("cursor");
    });
  });

  describe("getPresenceSnapshot", () => {
    it("returns grouped-by-user snapshot", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 10 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "focus", payload: { messageId: "m1" } });
      const snapshot = await getPresenceSnapshot(env, { roomId: "r1" });
      expect(snapshot.u1).toBeDefined();
      expect(snapshot.u1.cursor).toBeDefined();
      expect(snapshot.u1.focus).toBeDefined();
      expect(snapshot.u1.cursor.payload.x).toBe(10);
    });
  });

  describe("clearPresence", () => {
    it("clears all presence for a user in a room", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 1 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "focus", payload: {} });
      const result = await clearPresence(env, { roomId: "r1", userId: "u1" });
      expect(result.deleted).toBe(2);
    });
  });

  describe("clearStalePresence", () => {
    it("removes expired presence entries", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 1 } });
      // Manually set expires_at to past
      env._store[0].expires_at = "2020-01-01T00:00:00Z";
      const result = await clearStalePresence(env);
      expect(result.deleted).toBe(1);
    });
  });

  describe("getPresenceStats", () => {
    it("counts users per presence type", async () => {
      const env = makeEnv();
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "cursor", payload: { x: 1 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u2", type: "cursor", payload: { x: 2 } });
      await updatePresence(env, { projectId: "p1", roomId: "r1", userId: "u1", type: "focus", payload: {} });
      const stats = await getPresenceStats(env, { roomId: "r1" });
      expect(stats.cursor).toBe(2);
      expect(stats.focus).toBe(1);
    });
  });
});
