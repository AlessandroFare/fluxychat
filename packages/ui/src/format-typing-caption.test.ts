import { describe, expect, it } from "vitest";
import { formatTypingCaption, formatTypingCaptionFromMap } from "./format-typing-caption";

describe("formatTypingCaption", () => {
  it("returns null when nobody is typing", () => {
    expect(formatTypingCaption([])).toBeNull();
  });

  it("uses a single name", () => {
    expect(formatTypingCaption(["Ada"])).toBe("Ada is typing…");
  });

  it("joins two names", () => {
    expect(formatTypingCaption(["Ada", "Bob"])).toBe("Ada and Bob are typing…");
  });

  it("counts three or more", () => {
    expect(formatTypingCaption(["Ada", "Bob", "Cam"])).toBe("3 people are typing…");
  });
});

describe("formatTypingCaptionFromMap", () => {
  it("skips the local user and inactive flags", () => {
    expect(
      formatTypingCaptionFromMap(
        { ada: true, me: true, bob: false },
        { excludeUserId: "me", resolveName: (id) => id[0]!.toUpperCase() + id.slice(1) },
      ),
    ).toBe("Ada is typing…");
  });
});
