import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { decodeYjsFrame, encodeYjsFrame, YJS_MSG_UPDATE } from "./yjs-binary";
import {
  applyStoragePatch,
  FLUXY_YJS_STORAGE_MAP,
  isLiveFile,
  jsonToYValue,
  liveFileFromAttachment,
  storageMapToJson,
} from "./yjs-storage";

describe("yjs binary frames", () => {
  it("round-trips type + payload", () => {
    const payload = new Uint8Array([9, 8, 7]);
    const frame = encodeYjsFrame(YJS_MSG_UPDATE, payload);
    const decoded = decodeYjsFrame(frame);
    expect(decoded?.type).toBe(1);
    expect(Array.from(decoded?.payload ?? [])).toEqual([9, 8, 7]);
  });
});

describe("yjs storage JSON", () => {
  it("snapshots nested maps and arrays", () => {
    const doc = new Y.Doc();
    const root = doc.getMap(FLUXY_YJS_STORAGE_MAP);
    applyStoragePatch(root, {
      title: "Board",
      count: 2,
      tags: ["a", "b"],
      nested: { ok: true },
    });
    expect(storageMapToJson(root)).toEqual({
      title: "Board",
      count: 2,
      tags: ["a", "b"],
      nested: { ok: true },
    });
  });

  it("stores LiveFile as a JSON ref, not bytes", () => {
    const file = liveFileFromAttachment({
      kind: "image",
      url: "https://cdn.example/x.png",
      name: "x.png",
      sizeBytes: 12,
      contentType: "image/png",
    });
    expect(isLiveFile(file)).toBe(true);
    const doc = new Y.Doc();
    const root = doc.getMap(FLUXY_YJS_STORAGE_MAP);
    applyStoragePatch(root, { hero: file });
    expect(storageMapToJson(root).hero).toEqual(file);
  });

  it("deletes keys when patch value is undefined", () => {
    const doc = new Y.Doc();
    const root = doc.getMap(FLUXY_YJS_STORAGE_MAP);
    root.set("gone", "yes");
    applyStoragePatch(root, { gone: undefined });
    expect(storageMapToJson(root)).toEqual({});
  });

  it("wraps plain objects as Y.Map", () => {
    const nested = jsonToYValue({ a: 1 });
    expect(nested).toBeInstanceOf(Y.Map);
  });
});
