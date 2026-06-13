import { describe, expect, it } from "vitest";
import { parseInboundWsFrame, isKnownOutboundClientEvent } from "./parse-inbound-frame.js";

describe("parseInboundWsFrame", () => {
  it("parses pong", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "pong", ts: 1 }))).toEqual({ kind: "pong" });
  });

  it("parses replay snapshot", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "replay", messages: [{ id: 1 }] }))).toEqual({
      kind: "replay",
      messages: [{ id: 1 }],
    });
  });

  it("parses deliverable events", () => {
    const frame = parseInboundWsFrame(JSON.stringify({ type: "message", id: 2, content: "hi" }));
    expect(frame?.kind).toBe("event");
    expect(frame?.event?.type).toBe("message");
  });

  it("ignores unknown inbound types", () => {
    expect(parseInboundWsFrame(JSON.stringify({ type: "totally_unknown" }))).toEqual({ kind: "ignored" });
  });

  it("returns null on invalid JSON", () => {
    expect(parseInboundWsFrame("{")).toBeNull();
  });
});

describe("isKnownOutboundClientEvent", () => {
  it("accepts room DO client events", () => {
    expect(isKnownOutboundClientEvent({ type: "message", content: "x" })).toBe(true);
    expect(isKnownOutboundClientEvent({ type: "edit", id: 1 })).toBe(true);
  });

  it("rejects unknown outbound types", () => {
    expect(isKnownOutboundClientEvent({ type: "subscribe" })).toBe(false);
    expect(isKnownOutboundClientEvent(null)).toBe(false);
  });
});
