import { describe, expect, it, vi } from "vitest";
import {
  editExternalGenerationInRoom,
  messageIdFromGenerationBody,
  publishExternalGenerationChunksToRoom,
  publishExternalGenerationToRoom,
} from "./fluxy-external-generation";

describe("publishExternalGenerationToRoom", () => {
  it("POSTs finished text to /messages", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ message: { id: 1 } }), { status: 201 }),
    ) as unknown as typeof fetch;
    const result = await publishExternalGenerationToRoom({
      workerUrl: "https://worker.example/",
      token: "jwt",
      roomId: "lobby",
      content: "done",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messageId).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://worker.example/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects empty content", async () => {
    const result = await publishExternalGenerationToRoom({
      workerUrl: "https://worker.example",
      token: "jwt",
      roomId: "lobby",
      content: "  ",
    });
    expect(result.ok).toBe(false);
  });
});

describe("external generation chunks", () => {
  it("reads nested message.id", () => {
    expect(messageIdFromGenerationBody({ message: { id: 9 } })).toBe(9);
  });

  it("POSTs then PATCHes as chunks arrive", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ message: { id: 42 } }), { status: 201 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await publishExternalGenerationChunksToRoom({
      workerUrl: "https://worker.example",
      token: "jwt",
      roomId: "lobby",
      chunks: ["Hel", "lo"],
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe(42);
      expect(result.content).toBe("Hello");
    }
    expect(calls[0]).toContain("POST");
    expect(calls[1]).toContain("PATCH");
    expect(calls[1]).toContain("/messages/42");
  });

  it("PATCHes an existing row", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await editExternalGenerationInRoom({
      workerUrl: "https://worker.example",
      token: "jwt",
      messageId: 3,
      content: "later",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://worker.example/messages/3",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
