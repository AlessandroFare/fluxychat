import { describe, expect, it } from "vitest";
import { hasOtherPresenceMember } from "./demo-presence";

describe("hasOtherPresenceMember", () => {
  it("ignores our own sockets and empty lists", () => {
    expect(hasOtherPresenceMember([{ userId: "guest" }, { userId: "guest" }], "guest")).toBe(false);
    expect(hasOtherPresenceMember([], "guest")).toBe(false);
  });

  it("returns true only for a distinct user id", () => {
    expect(hasOtherPresenceMember([{ userId: "guest" }, { userId: "maya-bot" }], "guest")).toBe(true);
  });
});
