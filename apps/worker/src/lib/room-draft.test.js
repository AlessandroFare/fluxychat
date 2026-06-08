import { describe, expect, it } from "vitest";
import {
  readMessageDraftFromPreferences,
  validateDraftContent,
  writeMessageDraftToPreferences,
} from "./room-draft.js";

describe("room-draft", () => {
  it("allows empty draft content", () => {
    expect(validateDraftContent("")).toEqual({ valid: true, content: "" });
  });

  it("round-trips draft in preferences", () => {
    const prefs = writeMessageDraftToPreferences({}, {
      content: "hello",
      replyToId: 42,
    });
    const draft = readMessageDraftFromPreferences(prefs);
    expect(draft?.content).toBe("hello");
    expect(draft?.replyToId).toBe(42);
  });

  it("clears draft when content is blank", () => {
    const prefs = writeMessageDraftToPreferences(
      { messageDraft: { content: "x", replyToId: null, updatedAt: "t" } },
      { content: "   ", replyToId: null },
    );
    expect(readMessageDraftFromPreferences(prefs)).toBeNull();
  });
});
