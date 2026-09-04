import { describe, expect, it } from "vitest";
import {
  decodeRoomThreadCursor,
  encodeRoomThreadCursor,
  messagesInReplyThread,
} from "./chat-threads";

describe("messagesInReplyThread", () => {
  it("keeps only direct replies, not nested depth-2", () => {
    const messages = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 4, parentId: 1 },
    ];
    expect(messagesInReplyThread(messages, 1).map((m) => m.id)).toEqual([2, 4]);
    expect(messagesInReplyThread(messages, 2).map((m) => m.id)).toEqual([3]);
  });
});

describe("room thread cursor", () => {
  it("round-trips lastReplyAt + id", () => {
    const encoded = encodeRoomThreadCursor("2026-09-04T10:00:00.000Z", 42);
    expect(decodeRoomThreadCursor(encoded)).toEqual({
      t: "2026-09-04T10:00:00.000Z",
      id: 42,
    });
  });

  it("rejects junk", () => {
    expect(decodeRoomThreadCursor("nope")).toBeNull();
  });
});
