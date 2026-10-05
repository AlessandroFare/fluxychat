import { describe, expect, it } from "vitest";
import { formatTraceparent, injectW3cTraceHeaders } from "./w3c-trace-context.js";

describe("w3c-trace-context", () => {
  it("formats version-trace-span-flags", () => {
    const header = formatTraceparent({ traceId: "abc", spanId: "def", sampled: true });
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("injects traceparent without dropping existing headers", () => {
    const headers = injectW3cTraceHeaders(
      { Authorization: "Bearer x" },
      { traceId: "run-1", spanId: "span-1" },
    );
    expect(headers.Authorization).toBe("Bearer x");
    expect(headers.traceparent).toMatch(/^00-/);
  });
});
