import { describe, it, expect } from "vitest";
import { serializeMessage, deserializeMessage, messageToJSON, messageFromJSON } from "./message-serialization";
import type { FluxyChatMessage } from "./index";

const base: FluxyChatMessage & { metadata?: Record<string, unknown> } = {
  id: 1, roomId: "r1", userId: "u1", content: "hello", createdAt: "2025-01-01T00:00:00Z",
};

describe("serializeMessage", () => {
  it("serializes a basic message", () => {
    const s = serializeMessage(base as FluxyChatMessage);
    expect(s.v).toBe(1);
    expect(s.content).toBe("hello");
  });

  it("includes optional fields", () => {
    const s = serializeMessage({
      ...base, parentId: 0, editedAt: "2025-01-01T01:00:00Z",
      mentions: ["u2"], attachments: [{ id: 10, kind: "image", url: "https://example.com/img.png", name: "img.png", sizeBytes: 100, contentType: "image/png" }],
    } as FluxyChatMessage);
    expect(s.parentId).toBe(0);
    expect(s.editedAt).toBeTruthy();
    expect(s.mentions).toEqual(["u2"]);
    expect(s.attachments).toHaveLength(1);
    expect(s.attachments![0].kind).toBe("image");
  });

  it("includes metadata", () => {
    const msg: any = { id: 1, roomId: "r1", userId: "u1", content: "hello", createdAt: "2025-01-01T00:00:00Z", metadata: { source: "web" } };
    const s = serializeMessage(msg);
    expect(s.metadata).toEqual({ source: "web" });
  });
});

describe("deserializeMessage", () => {
  it("deserializes a basic message", () => {
    const msg = deserializeMessage({ v: 1, id: 1, roomId: "r1", userId: "u1", content: "hello", createdAt: "2025-01-01T00:00:00Z" });
    expect(msg.content).toBe("hello");
  });

  it("throws on unknown version", () => {
    expect(() => deserializeMessage({ v: 2 } as any)).toThrow("version");
  });

  it("restores optional fields", () => {
    const msg = deserializeMessage({
      v: 1, id: 1, roomId: "r1", userId: "u1", content: "hi", createdAt: "2025-01-01T00:00:00Z",
      parentId: 0, deletedAt: "2025-01-01T02:00:00Z",
      mentions: ["u2"],
      attachments: [{ id: 10, kind: "document", url: "https://example.com/doc.pdf", name: "doc.pdf", sizeBytes: 500, contentType: "application/pdf" }],
      metadata: { flag: true },
    });
    expect(msg.parentId).toBe(0);
    expect(msg.deletedAt).toBeTruthy();
    expect(msg.mentions).toEqual(["u2"]);
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments![0].kind).toBe("document");
    expect((msg as any).metadata).toEqual({ flag: true });
  });
});

describe("messageToJSON / messageFromJSON", () => {
  it("round-trips a message", () => {
    const json = messageToJSON(base as FluxyChatMessage);
    const restored = messageFromJSON(json);
    expect(restored.id).toBe(base.id);
    expect(restored.content).toBe(base.content);
  });

  it("round-trips with all optional fields", () => {
    const full = {
      ...base, parentId: 0, editedAt: "2025-01-01T01:00:00Z", mentions: ["u2"],
      attachments: [{ id: 10, kind: "image" as const, url: "https://img.png", name: "img.png", sizeBytes: 100, contentType: "image/png" }],
    };
    const json = messageToJSON(full as FluxyChatMessage);
    const restored = messageFromJSON(json);
    expect(restored.parentId).toBe(0);
    expect(restored.mentions).toEqual(["u2"]);
    expect(restored.attachments).toHaveLength(1);
  });
});
