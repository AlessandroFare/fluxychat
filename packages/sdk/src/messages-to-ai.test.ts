import { describe, it, expect } from "vitest";
import { toAiMessages, type AiUserMessage } from "./messages-to-ai";
import type { FluxyChatMessage } from "./index";

function makeMsg(overrides: Partial<FluxyChatMessage> & { id: number }): FluxyChatMessage {
  return {
    roomId: "room-1",
    userId: "user-1",
    content: "hello",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("toAiMessages", () => {
  it("converts user messages with user role", async () => {
    const msgs = [makeMsg({ id: 1, content: "hello", userId: "user-1" })];
    const result = await toAiMessages(msgs, { botUserId: "bot-1" });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("hello");
  });

  it("converts bot messages with assistant role via senderId", async () => {
    const msgs = [makeMsg({ id: 1, content: "I am a bot", senderId: "bot-1", userId: "bot-1" })];
    const result = await toAiMessages(msgs, { botUserId: "bot-1" });
    expect(result[0].role).toBe("assistant");
  });

  it("converts bot messages with assistant role via userId", async () => {
    const msgs = [makeMsg({ id: 1, content: "I am a bot", userId: "bot-1" })];
    const result = await toAiMessages(msgs, { botUserId: "bot-1" });
    expect(result[0].role).toBe("assistant");
  });

  it("sorts messages chronologically", async () => {
    const msgs = [
      makeMsg({ id: 2, content: "second", createdAt: "2026-01-01T00:00:02Z" }),
      makeMsg({ id: 1, content: "first", createdAt: "2026-01-01T00:00:01Z" }),
    ];
    const result = await toAiMessages(msgs);
    expect(result[0].content).toBe("first");
    expect(result[1].content).toBe("second");
  });

  it("filters out empty content", async () => {
    const msgs = [
      makeMsg({ id: 1, content: "" }),
      makeMsg({ id: 2, content: "   " }),
      makeMsg({ id: 3, content: "valid" }),
    ];
    const result = await toAiMessages(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("valid");
  });

  it("includes names when includeNames is true", async () => {
    const msgs = [makeMsg({ id: 1, content: "hello", userId: "alice", senderId: "alice" })];
    const result = await toAiMessages(msgs, { includeNames: true });
    expect((result[0] as AiUserMessage).content).toBe("[alice]: hello");
  });

  it("appends link preview to content", async () => {
    const msgs = [
      makeMsg({
        id: 1,
        content: "check this",
        preview: { url: "https://example.com", title: "Example", description: "A site", imageUrl: null },
      }),
    ];
    const result = await toAiMessages(msgs);
    expect(result[0].content).toContain("https://example.com");
    expect(result[0].content).toContain("Title: Example");
    expect(result[0].content).toContain("Description: A site");
  });

  it("converts image attachment to file part", async () => {
    const msgs = [
      makeMsg({
        id: 1,
        content: "see this",
        attachments: [
          { kind: "image", url: "https://example.com/img.png", name: "img.png", contentType: "image/png" },
        ],
      }),
    ];
    const result = await toAiMessages(msgs);
    expect(result[0].role).toBe("user");
    const content = (result[0] as AiUserMessage).content;
    expect(Array.isArray(content)).toBe(true);
    expect(content).toEqual([
      { type: "text", text: "see this" },
      { type: "file", data: "https://example.com/img.png", filename: "img.png", mediaType: "image/png" },
    ]);
  });

  it("converts text file attachment to file part", async () => {
    const msgs = [
      makeMsg({
        id: 1,
        content: "here's a file",
        attachments: [
          { kind: "file", url: "https://example.com/data.json", name: "data.json", contentType: "application/json" },
        ],
      }),
    ];
    const result = await toAiMessages(msgs);
    const content = (result[0] as AiUserMessage).content;
    expect(Array.isArray(content)).toBe(true);
    expect(content).toEqual([
      { type: "text", text: "here's a file" },
      { type: "file", data: "https://example.com/data.json", filename: "data.json", mediaType: "application/json" },
    ]);
  });

  it("warns on unsupported attachments", async () => {
    const warns: string[] = [];
    const msgs = [
      makeMsg({
        id: 1,
        content: "audio",
        attachments: [
          { kind: "audio", url: "https://example.com/sound.mp3", name: "sound.mp3", contentType: "audio/mpeg" },
        ],
      }),
    ];
    await toAiMessages(msgs, {
      onUnsupportedAttachment: (att) => {
        warns.push(`unsupported: ${att.kind}`);
      },
    });
    expect(warns).toContain("unsupported: audio");
  });

  it("transformMessage can modify content", async () => {
    const msgs = [makeMsg({ id: 1, content: "hello" })];
    const result = await toAiMessages(msgs, {
      transformMessage: (msg) => ({ ...msg, content: `prefix: ${msg.content}` }),
    });
    expect(result[0].content).toBe("prefix: hello");
  });

  it("transformMessage can skip messages by returning null", async () => {
    const msgs = [
      makeMsg({ id: 1, content: "keep" }),
      makeMsg({ id: 2, content: "skip" }),
    ];
    const result = await toAiMessages(msgs, {
      transformMessage: (msg) => (msg.content === "skip" ? null : msg),
    });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("keep");
  });

  it("handles empty array", async () => {
    const result = await toAiMessages([]);
    expect(result).toEqual([]);
  });

  it("all-filters removes all messages", async () => {
    const msgs = [makeMsg({ id: 1, content: "" }), makeMsg({ id: 2, content: "" })];
    const result = await toAiMessages(msgs);
    expect(result).toEqual([]);
  });
});
