import { describe, expect, it } from "vitest";
import { createPushProvider, hitlPushCopy } from "./push-provider";

describe("push provider", () => {
  it("keeps HITL copy free of payload secrets", () => {
    const copy = hitlPushCopy();
    expect(copy.body).not.toMatch(/tool|secret|token/i);
    expect(copy.interruptionLevel).toBe("time-sensitive");
  });

  it("wraps a backend", async () => {
    const provider = createPushProvider("expo", async () => ({ ok: true, receiptId: "r1" }));
    const result = await provider.send(
      { userId: "u1", token: "ExponentPushToken[x]", backend: "expo" },
      { ...hitlPushCopy(), path: "/rooms/r1" },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown backends", () => {
    expect(() => createPushProvider("onesignal" as never, async () => ({ ok: true }))).toThrow("unknown_push_backend");
  });
});
