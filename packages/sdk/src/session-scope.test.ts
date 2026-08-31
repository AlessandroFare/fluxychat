import { describe, expect, it } from "vitest";
import { DEFAULT_PROVIDER_SESSION_SCOPE, resolveRoomSessionScope } from "./session-scope";

describe("resolveRoomSessionScope", () => {
  it("prefers an explicit scope", () => {
    expect(resolveRoomSessionScope("assistant", "app", "r1")).toBe("assistant");
  });

  it("uses the provider scope when the hook omits one", () => {
    expect(resolveRoomSessionScope(undefined, DEFAULT_PROVIDER_SESSION_SCOPE, "r1")).toBe("app");
  });

  it("falls back to the hook instance when there is no provider", () => {
    expect(resolveRoomSessionScope(undefined, undefined, ":r1:")).toBe(":r1:");
  });
});
