import { describe, it, expect } from "vitest";
import { createKbSource } from "./kb-connectors.js";

describe("kb-connectors", () => {
  it("rejects invalid source type", async () => {
    const env = { RATE_LIMIT_KV: null };
    const result = await createKbSource(env, { projectId: "p1", type: "invalid", name: "X" });
    expect(result.error).toBe("invalid_type");
  });

  it("requires name", async () => {
    const env = { RATE_LIMIT_KV: null };
    const result = await createKbSource(env, { projectId: "p1", type: "url", name: "  " });
    expect(result.error).toBe("name_required");
  });
});
