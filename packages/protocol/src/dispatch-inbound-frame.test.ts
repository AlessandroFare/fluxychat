import { describe, expect, it, vi } from "vitest";
import { dispatchInboundWsFrame } from "./dispatch-inbound-frame.js";

describe("dispatchInboundWsFrame", () => {
  it("invokes onUnknownFrame for forward-compat passthrough", () => {
    const onUnknownFrame = vi.fn();
    dispatchInboundWsFrame(
      JSON.stringify({ type: "future_frame", schema: 2 }),
      {
        onPong: vi.fn(),
        onReplay: vi.fn(),
        onHistoryMarker: vi.fn(),
        onWorkerError: vi.fn(),
        onEvent: vi.fn(),
        onUnknownFrame,
      },
    );
    expect(onUnknownFrame).toHaveBeenCalledWith({
      type: "future_frame",
      schema: 2,
    });
  });

  it("does not call onUnknownFrame for known deliverable events", () => {
    const onUnknownFrame = vi.fn();
    const onEvent = vi.fn();
    dispatchInboundWsFrame(JSON.stringify({ type: "message", id: 1 }), {
      onPong: vi.fn(),
      onReplay: vi.fn(),
      onHistoryMarker: vi.fn(),
      onWorkerError: vi.fn(),
      onEvent,
      onUnknownFrame,
    });
    expect(onUnknownFrame).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalled();
  });
});
