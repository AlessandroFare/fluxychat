import { describe, expect, it } from "vitest";
import {
  YJS_MSG_AWARENESS,
  YJS_MSG_SYNC,
  YJS_MSG_UPDATE,
  decodeYjsAwareness,
  decodeYjsFrame,
  encodeYjsAwareness,
  encodeYjsAwarenessLeave,
  encodeYjsFrame,
  isPermanentYjsClose,
  isYjsAwarenessLeave,
} from "./yjs-binary";

describe("yjs binary frames", () => {
  it("round-trips type + payload", () => {
    const payload = new Uint8Array([7, 8, 9]);
    const frame = encodeYjsFrame(YJS_MSG_UPDATE, payload);
    expect(frame[0]).toBe(YJS_MSG_UPDATE);
    expect(frame.byteLength).toBe(1 + payload.byteLength);

    const decoded = decodeYjsFrame(frame);
    expect(decoded?.type).toBe(YJS_MSG_UPDATE);
    expect(Array.from(decoded?.payload ?? [])).toEqual([7, 8, 9]);
  });

  it("decodes a bare type byte and rejects empty frames", () => {
    expect(decodeYjsFrame(new Uint8Array([YJS_MSG_SYNC]))).toEqual({
      type: YJS_MSG_SYNC,
      payload: new Uint8Array(0),
    });
    expect(decodeYjsFrame(new Uint8Array(0))).toBeNull();
  });

  it("encodes awareness state and leave frames on the awareness channel", () => {
    const frame = encodeYjsAwareness({
      userId: "u1",
      name: "Ada",
      color: "#6366f1",
      cursor: { x: 1.5, y: 2 },
    });
    expect(frame[0]).toBe(YJS_MSG_AWARENESS);
    const state = decodeYjsAwareness(frame.slice(1));
    expect(state).toMatchObject({ userId: "u1", name: "Ada", cursor: { x: 1.5, y: 2 } });
    expect(isYjsAwarenessLeave(state)).toBe(false);

    const leave = decodeYjsAwareness(encodeYjsAwarenessLeave("u1").slice(1));
    expect(isYjsAwarenessLeave(leave)).toBe(true);
    expect(leave).toMatchObject({ userId: "u1", left: true });
  });

  it("rejects malformed awareness payloads", () => {
    expect(decodeYjsAwareness(new TextEncoder().encode("not-json"))).toBeNull();
    expect(decodeYjsAwareness(new TextEncoder().encode('{"name":"no user"}'))).toBeNull();
    expect(decodeYjsAwareness(new TextEncoder().encode('{"userId":"   "}'))).toBeNull();
  });

  it("classifies permanent close codes", () => {
    expect(isPermanentYjsClose(1008)).toBe(true);
    expect(isPermanentYjsClose(4400)).toBe(true);
    expect(isPermanentYjsClose(4499)).toBe(true);
    expect(isPermanentYjsClose(4500)).toBe(false);
    expect(isPermanentYjsClose(1000)).toBe(false);
  });
});
