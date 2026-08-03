import { describe, it, expect } from "vitest";
import {
  mergeMessageExpiry,
  resolveRoomDefaultExpiresAt,
  purgeExpiredRoomMessages,
} from "./message-retention-room.js";

describe("message-retention-room", () => {
  const env = { MESSAGE_TTL_MAX_SECONDS: 86400 };

  it("resolveRoomDefaultExpiresAt returns ISO for ephemeral rooms", () => {
    const expires = resolveRoomDefaultExpiresAt({ mode: "ephemeral", ttlSeconds: 3600 }, env);
    expect(expires).toBeTruthy();
    expect(Date.parse(expires)).toBeGreaterThan(Date.now());
  });

  it("resolveRoomDefaultExpiresAt returns null for standard mode", () => {
    expect(resolveRoomDefaultExpiresAt({ mode: "standard", ttlSeconds: null }, env)).toBeNull();
  });

  it("mergeMessageExpiry picks the earlier expiry", () => {
    const client = new Date(Date.now() + 7200 * 1000).toISOString();
    const room = new Date(Date.now() + 3600 * 1000).toISOString();
    expect(mergeMessageExpiry(client, room)).toBe(room);
  });

  it("purgeExpiredRoomMessages uses batched SELECT + UPDATE", async () => {
    const updates = [];
    const envMock = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("room_message_retention")) {
                    return { mode: "ephemeral", ttl_seconds: 3600, updated_at: "2026-01-01" };
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("SELECT id FROM messages")) {
                    return { results: [{ id: 42 }, { id: 43 }] };
                  }
                  return { results: [] };
                },
                async run() {
                  if (sql.includes("UPDATE messages SET deleted_at")) {
                    updates.push(args);
                  }
                  return { meta: { changes: 2 } };
                },
              };
            },
          };
        },
      },
    };

    const result = await purgeExpiredRoomMessages(envMock, {
      projectId: "p1",
      roomId: "r1",
      limit: 500,
    });
    expect(result.ok).toBe(true);
    expect(result.purged).toBe(2);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual([42, 43]);
  });
});
