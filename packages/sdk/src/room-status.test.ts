import { describe, expect, it } from "vitest";
import { fluxySubscription } from "./fluxy-subscription";
import { attachStatusFromConnection, roomStatusFn } from "./room-status";

describe("room.status HOW", () => {
  it("maps connection states like Ably attach status", () => {
    expect(attachStatusFromConnection("idle")).toBe("initialized");
    expect(attachStatusFromConnection("connecting")).toBe("attaching");
    expect(attachStatusFromConnection("connected")).toBe("attached");
    expect(attachStatusFromConnection("reconnecting")).toBe("suspended");
    expect(attachStatusFromConnection("failed")).toBe("failed");
  });

  it("is callable, current(), and stringifies to the attach label", () => {
    let current: "attached" | "suspended" = "attached";
    const status = roomStatusFn(
      () => current,
      () => fluxySubscription(() => {}),
    );
    expect(status()).toBe("attached");
    expect(status.current()).toBe("attached");
    expect(String(status)).toBe("attached");
    expect(typeof status.subscribe).toBe("function");
    current = "suspended";
    expect(status()).toBe("suspended");
  });
});
