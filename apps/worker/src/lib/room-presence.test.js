import { describe, expect, it } from "vitest";
import {
  buildPresenceMembers,
  normalizeClientEventName,
  parsePresenceInfoParam,
} from "./room-presence.js";

describe("room-presence", () => {
  it("parses presence info JSON", () => {
    expect(parsePresenceInfoParam('{"name":"Alice"}')).toEqual({ name: "Alice" });
  });

  it("builds member list with userInfo", () => {
    const info = new Map([["u1", { name: "Bob" }]]);
    expect(buildPresenceMembers(["u1"], info)).toEqual([
      { userId: "u1", userInfo: { name: "Bob" } },
    ]);
  });

  it("requires client- prefix", () => {
    expect(normalizeClientEventName("client-typing").ok).toBe(true);
    expect(normalizeClientEventName("typing").ok).toBe(false);
  });
});
