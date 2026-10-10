import { describe, expect, it } from "vitest";
import { formatSenderTooltip } from "./format-sender-tooltip";

describe("formatSenderTooltip", () => {
  it("uses the display name alone when it matches the user id", () => {
    expect(formatSenderTooltip({ displayName: "ada", userId: "ada" })).toBe("ada");
  });

  it("includes a distinct user id", () => {
    expect(formatSenderTooltip({ displayName: "Ada", userId: "user_ada" })).toBe("Ada · user_ada");
  });
});
