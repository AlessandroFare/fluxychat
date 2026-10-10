import { describe, expect, it } from "vitest";
import {
  aggregateClientConnectionStatus,
  createClientConnection,
  mapRoomStatusToClientConnection,
} from "./client-connection";
import type { FluxyChatRoomConnection, FluxyRoomConnectionStatus } from "./room-connection";

function fakeRoom(status: FluxyRoomConnectionStatus) {
  return { connectionStatus: status } as FluxyChatRoomConnection;
}

describe("client connection aggregate", () => {
  it("FX-CONN-1 maps room statuses to ChatClient.connection names", () => {
    expect(mapRoomStatusToClientConnection("idle")).toBe("initialized");
    expect(mapRoomStatusToClientConnection("reconnecting")).toBe("disconnected");
    expect(mapRoomStatusToClientConnection("failed")).toBe("failed");
    expect(aggregateClientConnectionStatus([], false)).toBe("initialized");
    expect(aggregateClientConnectionStatus([fakeRoom("connecting")], false)).toBe("connecting");
    expect(aggregateClientConnectionStatus([fakeRoom("connected"), fakeRoom("failed")], false)).toBe(
      "connected",
    );
    expect(aggregateClientConnectionStatus([fakeRoom("connected")], true)).toBe("closed");
  });

  it("FX-CONN-4 whenState resolves immediately if already there", async () => {
    const listeners: Array<(change: { current: string; previous: string }) => void> = [];
    let status: "initialized" | "connected" = "initialized";
    const connection = createClientConnection({
      status: () => status,
      error: () => undefined,
      subscribe: (listener) => {
        listeners.push(listener);
        return () => {};
      },
      ping: async () => 1,
    });
    await expect(connection.whenState("initialized")).resolves.toBeNull();
    const pending = connection.whenState("connected");
    status = "connected";
    for (const listener of listeners) {
      listener({ current: "connected", previous: "initialized" });
    }
    await expect(pending).resolves.toMatchObject({ current: "connected" });
  });
});
