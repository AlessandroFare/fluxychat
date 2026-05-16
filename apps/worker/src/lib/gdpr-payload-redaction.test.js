import { describe, expect, it } from "vitest";
import {
  GDPR_REDACTED_USER_MARKER,
  redactUserReferencesInJsonString,
  redactUserReferencesInValue,
} from "./gdpr-payload-redaction.js";

describe("redactUserReferencesInValue", () => {
  it("redacts known id fields and mention arrays", () => {
    const input = {
      userId: "alice",
      fromUserId: "alice",
      toUserIds: ["alice", "bob"],
      nested: { senderId: "alice", note: "alice said hi" },
    };
    const out = redactUserReferencesInValue(input, "alice");
    expect(out.userId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.fromUserId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.toUserIds).toEqual([GDPR_REDACTED_USER_MARKER, "bob"]);
    expect(out.nested.senderId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.nested.note).toBe("alice said hi");
  });
});

describe("redactUserReferencesInJsonString", () => {
  it("parses JSON and redacts deeply", () => {
    const raw = JSON.stringify({
      event: "mention.created",
      fromUserId: "u1",
      payload: { userId: "u1", messageId: 9 },
    });
    const next = redactUserReferencesInJsonString(raw, "u1");
    const parsed = JSON.parse(next);
    expect(parsed.fromUserId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(parsed.payload.userId).toBe(GDPR_REDACTED_USER_MARKER);
  });

  it("falls back to string replace on invalid JSON", () => {
    const raw = "not-json u1 tail";
    expect(redactUserReferencesInJsonString(raw, "u1")).toBe(
      `not-json ${GDPR_REDACTED_USER_MARKER} tail`
    );
  });
});
