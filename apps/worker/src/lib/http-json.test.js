import { describe, expect, it } from "vitest";
import { createJsonResponder } from "./http-json.js";

describe("createJsonResponder", () => {
  it("includes traceId on 4xx JSON bodies", async () => {
    const json = createJsonResponder({
      traceId: "trace-test-1",
      corsHeaders: { "X-Trace-Id": "trace-test-1" },
    });
    const res = json({ error: "quota_exceeded" }, { status: 402 });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body).toEqual({
      traceId: "trace-test-1",
      error: "quota_exceeded",
    });
  });

  it("does not add traceId to 2xx bodies", async () => {
    const json = createJsonResponder({
      traceId: "trace-test-2",
      corsHeaders: {},
    });
    const res = json({ ok: true });
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
