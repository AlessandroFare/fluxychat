import { describe, expect, it } from "vitest";
import {
  buildPresenceMembers,
  normalizeClientEventName,
  parsePresenceInfoParam,
  sanitizePresencePatch,
  shouldSkipClientEventWebhook,
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

  it("sanitizes presence patches and rejects junk", () => {
    expect(sanitizePresencePatch({ selection: { x: 1, y: 2, text: "ab" } }).data).toEqual({
      selection: { x: 1, y: 2, text: "ab" },
    });
    expect(sanitizePresencePatch({ cursor: null }).data).toEqual({ cursor: null });
    expect(sanitizePresencePatch({}).ok).toBe(false);
    expect(sanitizePresencePatch({ cursor: { x: "nope", y: 1 } }).ok).toBe(false);
    expect(sanitizePresencePatch({ agentStatus: "running" }).data).toEqual({
      agentStatus: "running",
    });
  });

  it("skips webhooks for client-ephemeral-* broadcasts", () => {
    expect(shouldSkipClientEventWebhook("client-ephemeral-knock")).toBe(true);
    expect(shouldSkipClientEventWebhook("client-highlight")).toBe(false);
  });
});
