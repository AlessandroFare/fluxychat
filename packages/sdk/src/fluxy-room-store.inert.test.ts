import { describe, expect, it } from "vitest";
import { INERT_FLUXY_ROOM_SNAPSHOT } from "./fluxy-room-store";

describe("INERT_FLUXY_ROOM_SNAPSHOT", () => {
  it("is referentially stable for useSyncExternalStore server snapshots", () => {
    expect(INERT_FLUXY_ROOM_SNAPSHOT).toBe(INERT_FLUXY_ROOM_SNAPSHOT);
    expect(INERT_FLUXY_ROOM_SNAPSHOT.connectionStatus).toBe("idle");
    expect(INERT_FLUXY_ROOM_SNAPSHOT.messages).toHaveLength(0);
    expect(INERT_FLUXY_ROOM_SNAPSHOT.connected).toBe(false);
  });

  it("exposes no-op actions without throwing until session binds real handlers", () => {
    expect(() => INERT_FLUXY_ROOM_SNAPSHOT.sendMessage("hi")).not.toThrow();
    expect(() => INERT_FLUXY_ROOM_SNAPSHOT.setTyping(true)).not.toThrow();
  });
});
