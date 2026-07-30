import { describe, expect, it } from "vitest";
import { normalizeClientMessageId, deriveScopedClientMessageId } from "./client-message-id.js";

describe("normalizeClientMessageId", () => {
  it("accepts cmsg_* ids", () => {
    expect(normalizeClientMessageId("cmsg_abc12345_xyz")).toBe("cmsg_abc12345_xyz");
  });

  it("rejects short or invalid ids", () => {
    expect(normalizeClientMessageId("short")).toBeNull();
    expect(normalizeClientMessageId("")).toBeNull();
    expect(normalizeClientMessageId("bad id!")).toBeNull();
  });
});

describe("deriveScopedClientMessageId", () => {
  it("sanitizes Matrix event ids", () => {
    const id = deriveScopedClientMessageId("matrix", "$evt1:example.com");
    expect(id).toMatch(/^matrix_/);
    expect(normalizeClientMessageId(id)).toBe(id);
  });

  it("sanitizes Slack timestamps", () => {
    const id = deriveScopedClientMessageId("slack", "1234567890.123456");
    expect(id).toBe("slack_1234567890_123456");
  });
});
