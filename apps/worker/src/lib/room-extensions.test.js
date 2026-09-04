import { describe, expect, it } from "vitest";
import {
  applyExtensionWrite,
  snapshotRoomExtensions,
  validateExtensionWrite,
  ROOM_EXT_MAX_SLOTS,
} from "./room-extensions.js";

describe("room-extensions", () => {
  it("increments counters and stores kv", () => {
    const kv = applyExtensionWrite(null, { kind: "kv", data: { n: 1 } });
    expect(kv.kind).toBe("kv");
    expect(kv.data).toEqual({ n: 1 });
    const c1 = applyExtensionWrite({ kind: "counter", data: 2 }, { kind: "counter", delta: 3 });
    expect(c1.data).toBe(5);
  });

  it("rejects undeclared ids when slots are declared", () => {
    const result = validateExtensionWrite({
      id: "votes",
      body: { kind: "counter", delta: 1 },
      existing: null,
      declared: [{ id: "state", kind: "kv" }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("undeclared_extension");
  });

  it("lists from Map storage", async () => {
    const storage = new Map([["ext:state", { kind: "kv", data: { ok: true } }]]);
    storage.list = async ({ prefix }) => {
      const out = new Map();
      for (const [k, v] of storage) if (k.startsWith(prefix)) out.set(k, v);
      return out;
    };
    const snap = await snapshotRoomExtensions(storage);
    expect(snap.state.data).toEqual({ ok: true });
    expect(ROOM_EXT_MAX_SLOTS).toBe(5);
  });
});
