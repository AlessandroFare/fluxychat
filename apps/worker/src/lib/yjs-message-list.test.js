import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  FLUXY_MESSAGES_MAP_KEY,
  readMessagesFromDoc,
  serializeMessageForYjs,
  shouldPreferYjsRecord,
  upsertMessageInDoc,
} from "./yjs-message-list.js";

describe("yjs-message-list", () => {
  it("upserts messages in Y.Map keyed by clientMessageId", () => {
    const doc = new Y.Doc();
    upsertMessageInDoc(doc, {
      id: 1,
      roomId: "r1",
      userId: "alice",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
      clientMessageId: "cmsg_1",
    });
    const map = doc.getMap(FLUXY_MESSAGES_MAP_KEY);
    expect(map.has("c:cmsg_1")).toBe(true);
    expect(readMessagesFromDoc(doc)).toHaveLength(1);
  });

  it("prefers newer editedAt on conflict", () => {
    const older = serializeMessageForYjs({
      id: 2,
      roomId: "r1",
      userId: "bob",
      content: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = serializeMessageForYjs({
      id: 2,
      roomId: "r1",
      userId: "bob",
      content: "final",
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-01T00:01:00.000Z",
    });
    expect(shouldPreferYjsRecord(older, newer)).toBe(true);
    expect(shouldPreferYjsRecord(newer, older)).toBe(false);
  });

  it("tombstones deleted messages out of read list", () => {
    const doc = new Y.Doc();
    upsertMessageInDoc(doc, {
      id: 3,
      roomId: "r1",
      userId: "alice",
      content: "gone",
      createdAt: "2026-01-01T00:00:00.000Z",
      deletedAt: "2026-01-01T00:02:00.000Z",
    });
    expect(readMessagesFromDoc(doc)).toHaveLength(0);
  });

});
