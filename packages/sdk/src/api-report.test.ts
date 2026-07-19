import { describe, it, expect } from "vitest";
import * as publicApi from "./index";

describe("API Report", () => {
  const allExports = Object.keys(publicApi).filter((k) => !k.startsWith("_")).sort();

  it("should not export internal-only symbols (prefixed with underscore)", () => {
    const internals = Object.keys(publicApi).filter((name) => name.startsWith("_"));
    expect(internals).toEqual([]);
  });

  it("each exported value should be a function or object (not undefined)", () => {
    for (const [key, value] of Object.entries(publicApi)) {
      expect([key, value]).not.toBeUndefined();
    }
  });

  it("export count should be reasonable (no accidental regressions)", () => {
    expect(allExports.length).toBeGreaterThanOrEqual(100);
  });

  it("should export core expected symbols", () => {
    const core = [
      "FluxyAuthError",
      "FluxyConnectionError",
      "ChatError",
      "RateLimitError",
      "LockError",
      "NotImplementedError",
      "createLogger",
      "createThreadState",
      "createDeterministicLanguageModel",
      "createTelemetryManager",
      "createDevToolsStore",
      "createDevToolsInspector",
      "callOptionsSchema",
      "dynamicTool",
      "createDynamicToolRegistry",
      "streamFixtures",
      "createMockAdapter",
      "createSpyAdapter",
    ];
    const missing = core.filter((name) => !allExports.includes(name));
    expect(missing).toEqual([]);
  });
});
