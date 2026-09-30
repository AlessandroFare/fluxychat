import { describe, expect, it } from "vitest";
import { mergeMcpAppState, normalizeMcpAppId } from "./mcp-app-state.js";

describe("mcp-app-state", () => {
  it("accepts ui:// ids", () => {
    expect(normalizeMcpAppId("ui://forms/deal")).toBe("ui://forms/deal");
    expect(normalizeMcpAppId("../x")).toBeNull();
  });

  it("merges patches unless replace", () => {
    expect(mergeMcpAppState({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
    expect(mergeMcpAppState({ a: 1 }, { b: 2 }, { replace: true })).toEqual({ b: 2 });
  });
});
