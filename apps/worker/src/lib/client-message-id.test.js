import { describe, expect, it } from "vitest";
import { normalizeClientMessageId } from "./client-message-id.js";

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
