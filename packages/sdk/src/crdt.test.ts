import { describe, it, expect } from "vitest";
import { createCrdt } from "./crdt";

describe("createCrdt", () => {
  it("creates an empty document", () => {
    const c = createCrdt();
    const doc = c.createDocument("doc-1");
    expect(doc.content).toBe("");
    expect(doc.version).toBe(0);
  });

  it("creates a document with initial content", () => {
    const c = createCrdt();
    const doc = c.createDocument("doc-1", "hello");
    expect(doc.content).toBe("hello");
  });

  it("getDocument returns null for unknown", () => {
    const c = createCrdt();
    expect(c.getDocument("x")).toBeNull();
  });

  it("applies insert operation", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "helo");
    c.applyOperation("doc-1", { userId: "u1", type: "insert", position: 3, value: "l" });
    expect(c.getDocument("doc-1")!.content).toBe("hello");
  });

  it("applies delete operation", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "hello!");
    c.applyOperation("doc-1", { userId: "u1", type: "delete", position: 5, length: 1 });
    expect(c.getDocument("doc-1")!.content).toBe("hello");
  });

  it("applies replace operation", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "hxllo");
    c.applyOperation("doc-1", { userId: "u1", type: "replace", position: 1, length: 1, value: "e" });
    expect(c.getDocument("doc-1")!.content).toBe("hello");
  });

  it("getOperationsSince returns ops after version", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "");
    const op1 = c.applyOperation("doc-1", { userId: "u1", type: "insert", position: 0, value: "a" });
    c.applyOperation("doc-1", { userId: "u1", type: "insert", position: 1, value: "b" });
    const ops = c.getOperationsSince("doc-1", op1.version);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe("b");
  });

  it("getDocumentAtVersion reconstructs state", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "");
    c.applyOperation("doc-1", { userId: "u1", type: "insert", position: 0, value: "hello" });
    const v1 = c.getDocument("doc-1")!.version;
    c.applyOperation("doc-1", { userId: "u1", type: "delete", position: 0, length: 1 });
    expect(c.getDocumentAtVersion("doc-1", v1)).toBe("hello");
  });

  it("awareness tracking", () => {
    const c = createCrdt();
    c.createDocument("doc-1");
    c.setAwareness("doc-1", { userId: "u1", cursorPosition: 5, lastActive: new Date().toISOString() });
    c.setAwareness("doc-1", { userId: "u2", selectionStart: 2, selectionEnd: 6, lastActive: new Date().toISOString() });
    const a = c.getAwareness("doc-1");
    expect(a).toHaveLength(2);
  });

  it("createSnapshot and applySnapshot round-trips", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "hello world");
    const snap = c.createSnapshot("doc-1");
    c.deleteDocument("doc-1");
    expect(c.getDocument("doc-1")).toBeNull();
    c.applySnapshot(snap);
    expect(c.getDocument("doc-1")!.content).toBe("hello world");
  });

  it("merge applies new operations", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "ab");
    const remoteOps: Parameters<ReturnType<typeof createCrdt>["merge"]>[1] = [
      { id: "r1", userId: "u2", type: "insert" as const, position: 1, value: "X", timestamp: "t1", siteId: 2, version: 2 },
    ];
    const applied = c.merge("doc-1", remoteOps);
    expect(applied).toHaveLength(1);
    expect(c.getDocument("doc-1")!.content).toBe("aXb");
  });

  it("merge skips duplicate operations", () => {
    const c = createCrdt();
    c.createDocument("doc-1", "a");
    const op = c.applyOperation("doc-1", { userId: "u1", type: "insert", position: 1, value: "b" });
    const alreadyApplied = [
      { id: op.id, userId: "u2", type: "insert" as const, position: 1, value: "b", timestamp: "t1", siteId: 2, version: 2 },
    ];
    const applied = c.merge("doc-1", alreadyApplied);
    expect(applied).toHaveLength(0);
  });

  it("applyOperation throws for unknown doc", () => {
    const c = createCrdt();
    expect(() => c.applyOperation("x", { userId: "u1", type: "insert", position: 0, value: "a" })).toThrow("not found");
  });
});
