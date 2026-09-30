import { describe, expect, it } from "vitest";
import { parseTranscriptExport } from "./transcript-import.js";

describe("parseTranscriptExport", () => {
  it("reads a ChatGPT mapping conversation", () => {
    const parsed = parseTranscriptExport([
      {
        title: "Taxes",
        mapping: {
          a: {
            message: {
              author: { role: "user" },
              content: { parts: ["hello"] },
              create_time: 1700000000,
            },
          },
          b: {
            message: {
              author: { role: "assistant" },
              content: { parts: ["hi there"] },
              create_time: 1700000001,
            },
          },
        },
      },
    ]);
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("chatgpt");
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0].content).toBe("hello");
    expect(parsed.messages[1].role).toBe("assistant");
  });

  it("reads Claude chat_messages", () => {
    const parsed = parseTranscriptExport({
      name: "Claude dump",
      chat_messages: [
        { sender: "human", text: "yo", created_at: "2026-01-01T00:00:00Z" },
        { sender: "assistant", text: "hey", created_at: "2026-01-01T00:00:01Z" },
      ],
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("claude");
    expect(parsed.title).toBe("Claude dump");
    expect(parsed.messages[1].content).toBe("hey");
  });

  it("rejects empty payloads", () => {
    expect(parseTranscriptExport({}).ok).toBe(false);
    expect(parseTranscriptExport([]).ok).toBe(false);
  });
});
