import { describe, expect, it, vi } from "vitest";
import { dispatchInboundWsFrame } from "./ws-inbound";

describe("dispatchInboundWsFrame", () => {
  it("routes pong without delivering", () => {
    const onPong = vi.fn();
    const onDeliver = vi.fn();
    dispatchInboundWsFrame(JSON.stringify({ type: "pong" }), {
      onPong,
      onReplay: vi.fn(),
      onHistoryMarker: vi.fn(),
      onWorkerError: vi.fn(),
      onDeliver,
    });
    expect(onPong).toHaveBeenCalledOnce();
    expect(onDeliver).not.toHaveBeenCalled();
  });

  it("forwards unknown server frames without delivering as events", () => {
    const onDeliver = vi.fn();
    const onUnknownFrame = vi.fn();
    dispatchInboundWsFrame(
      JSON.stringify({ type: "unknown_future_event", v: 1 }),
      {
        onPong: vi.fn(),
        onReplay: vi.fn(),
        onHistoryMarker: vi.fn(),
        onWorkerError: vi.fn(),
        onDeliver,
        onUnknownFrame,
      },
    );
    expect(onUnknownFrame).toHaveBeenCalledWith({
      type: "unknown_future_event",
      v: 1,
    });
    expect(onDeliver).not.toHaveBeenCalled();
  });

  it("delivers known message events", () => {
    const onDeliver = vi.fn();
    dispatchInboundWsFrame(JSON.stringify({ type: "message", id: 1, content: "hi" }), {
      onPong: vi.fn(),
      onReplay: vi.fn(),
      onHistoryMarker: vi.fn(),
      onWorkerError: vi.fn(),
      onDeliver,
    });
    expect(onDeliver).toHaveBeenCalledWith(expect.objectContaining({ type: "message", id: 1 }));
  });
});
