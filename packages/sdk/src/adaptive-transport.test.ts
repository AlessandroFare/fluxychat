import { describe, it, expect } from "vitest";
import { createAdaptiveTransport } from "./adaptive-transport";

describe("createAdaptiveTransport", () => {
  it("starts with websocket by default", () => {
    const t = createAdaptiveTransport();
    expect(t.getCurrentTransport()).toBe("websocket");
  });

  it("starts with configured transport", () => {
    const t = createAdaptiveTransport({ initialTransport: "sse" });
    expect(t.getCurrentTransport()).toBe("sse");
  });

  it("falls back after failures", () => {
    const t = createAdaptiveTransport({ failureThreshold: 2 });
    t.recordFailure();
    t.recordFailure();
    expect(t.getCurrentTransport()).toBe("sse");
  });

  it("records success resets failures", () => {
    const t = createAdaptiveTransport({ failureThreshold: 2 });
    t.recordFailure();
    t.recordSuccess();
    t.recordFailure();
    expect(t.getCurrentTransport()).toBe("websocket");
  });

  it("forceTransport changes transport", () => {
    const t = createAdaptiveTransport();
    t.forceTransport("polling");
    expect(t.getCurrentTransport()).toBe("polling");
  });

  it("triggers fallback callback", () => {
    const t = createAdaptiveTransport({ failureThreshold: 1 });
    const calls: string[] = [];
    t.onFallback((from, to) => calls.push(`${from}->${to}`));
    t.recordFailure();
    expect(calls).toEqual(["websocket->sse"]);
  });

  it("getHealth returns current status", () => {
    const t = createAdaptiveTransport();
    const h = t.getHealth();
    expect(h.transport).toBe("websocket");
    expect(h.connected).toBe(true);
  });
});
