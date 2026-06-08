import { describe, expect, it } from "vitest";
import {
  canUserSeeMessage,
  resolveMessageVisibility,
  whisperRecipientSet,
} from "./message-visibility.js";

describe("message-visibility", () => {
  it("requires visibleTo for whisper", () => {
    expect(resolveMessageVisibility({ visibility: "whisper" }).ok).toBe(false);
  });

  it("whisper recipients include sender", () => {
    const set = whisperRecipientSet("whisper", ["bob"], "alice");
    expect(set?.has("alice")).toBe(true);
    expect(set?.has("bob")).toBe(true);
  });

  it("filters whisper for non-recipients", () => {
    expect(
      canUserSeeMessage("whisper", '["bob"]', "carol", "alice"),
    ).toBe(false);
    expect(canUserSeeMessage("whisper", '["bob"]', "bob", "alice")).toBe(true);
  });
});
