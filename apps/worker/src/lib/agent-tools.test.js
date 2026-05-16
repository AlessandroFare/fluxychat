import { describe, it, expect } from "vitest";
import { executeToolCall, fetchAppContext } from "./agent-tools.js";

describe("executeToolCall", () => {
  it("blocks private tool execute URLs (SSRF)", async () => {
    const result = await executeToolCall(
      {},
      "http://127.0.0.1/tools",
      { id: "c1", name: "ping", arguments: "{}" },
      "proj",
      "run",
      "trace"
    );
    expect(result).toEqual({
      success: false,
      error: "tool_execute_url_blocked_ssrf",
    });
  });
});

describe("fetchAppContext", () => {
  it("returns null for private context fetch URLs", async () => {
    const result = await fetchAppContext(
      {},
      "http://localhost/context",
      "proj",
      "room",
      "user",
      "trace"
    );
    expect(result).toBeNull();
  });
});
