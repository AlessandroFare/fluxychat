import { describe, expect, it } from "vitest";
import { migrateVendorExportToImportRows, roomIdFromChannelName } from "./fluxy-migrate";

describe("fluxy-migrate", () => {
  it("maps Pusher-style channel names", () => {
    expect(roomIdFromChannelName("private-deal-42")).toBe("deal-42");
    expect(roomIdFromChannelName("presence-lobby")).toBe("lobby");
  });

  it("reads a channel map and caps at 400", () => {
    const rows = migrateVendorExportToImportRows({
      channels: {
        "private-ops": {
          events: [
            { data: { text: "hello" }, userId: "alice", timestamp: "2024-01-01T00:00:00.000Z" },
            { data: "skip-empty" },
          ],
        },
      },
    });
    expect(rows).toEqual([
      {
        roomId: "ops",
        content: "hello",
        userId: "alice",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      { roomId: "ops", content: "skip-empty" },
    ]);
    const many = Array.from({ length: 500 }, (_, i) => ({
      channel: "c",
      content: `m${i}`,
    }));
    expect(migrateVendorExportToImportRows(many)).toHaveLength(400);
  });
});
