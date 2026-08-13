import { describe, expect, it, vi } from "vitest";
import { fetchWithDoKeepalive, outboundStreamTags } from "./do-outbound-keepalive.js";

describe("do-outbound-keepalive", () => {
  it("returns fetch response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchWithDoKeepalive("https://example.com", { method: "GET" }, {
      feature: "llm_stream",
    });
    expect(res.status).toBe(200);
  });

  it("builds outbound stream tags", () => {
    expect(outboundStreamTags({ feature: "agent", projectId: "p1", roomId: "r1" })).toEqual({
      "X-Fluxy-Outbound-Feature": "agent",
      "X-Fluxy-Project-Id": "p1",
      "X-Fluxy-Room-Id": "r1",
    });
  });
});
