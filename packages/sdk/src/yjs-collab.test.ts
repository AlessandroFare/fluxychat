import { describe, expect, it } from "vitest";
import { YJS_SNAPSHOT_POLICY, createYjsCollabPort } from "./yjs-collab";

describe("yjs collab port", () => {
  it("creates document refs scoped to the room", () => {
    const port = createYjsCollabPort();
    expect(port.createDocumentRef("room_1")).toEqual({ docId: "doc_room_1", roomId: "room_1" });
    expect(port.createDocumentRef("room_1", "board")).toEqual({ docId: "board", roomId: "room_1" });
    expect(port.snapshotPolicy).toBe(YJS_SNAPSHOT_POLICY);
  });

  it("snapshots on op count or age, inclusive of the boundary", () => {
    const port = createYjsCollabPort();
    const { maxOps, maxAgeMs } = YJS_SNAPSHOT_POLICY;

    expect(port.shouldSnapshot(maxOps - 1, 1000, 1000 + maxAgeMs - 1)).toBe(false);
    expect(port.shouldSnapshot(maxOps, 1000, 1000)).toBe(true);
    expect(port.shouldSnapshot(1, 1000, 1000 + maxAgeMs)).toBe(true);
  });
});
