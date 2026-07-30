import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutPersistedMessage: vi.fn(async () => {}),
}));

import { importAdminMessage } from "./message-import.js";

function mockEnv({ roomExists = true, existingClientId = null } = {}) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              first: async () => {
                if (sql.includes("FROM rooms")) {
                  return roomExists ? { id: params[1] } : null;
                }
                if (sql.includes("client_message_id")) {
                  return existingClientId ? { id: 99 } : null;
                }
                return null;
              },
              run: async () => ({ meta: { last_row_id: 42, changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

describe("message-import", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  it("rejects missing room", async () => {
    const result = await importAdminMessage(mockEnv({ roomExists: false }), {
      projectId: "p1",
      roomId: "missing",
      content: "hello",
      userId: "u1",
    });
    expect(result.error).toBe("room_not_found");
  });

  it("imports with backdated createdAt", async () => {
    const result = await importAdminMessage(mockEnv(), {
      projectId: "p1",
      roomId: "room-1",
      content: "legacy",
      userId: "legacy-user",
      createdAt: "2024-06-01T12:00:00.000Z",
      clientMessageId: "legacy-1",
    });
    expect(result.imported).toBe(true);
    expect(result.messageId).toBe(42);
    expect(result.createdAt).toBe("2024-06-01T12:00:00.000Z");
  });

  it("skips duplicate clientMessageId", async () => {
    const result = await importAdminMessage(mockEnv({ existingClientId: true }), {
      projectId: "p1",
      roomId: "room-1",
      content: "dup",
      userId: "u1",
      clientMessageId: "legacy-1",
    });
    expect(result.skipped).toBe(true);
    expect(result.messageId).toBe(99);
  });
});
