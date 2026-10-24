import { beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletionMock = vi.fn();

vi.mock("./ai-chat-completion.js", () => ({
  chatCompletion: (...args) => chatCompletionMock(...args),
}));
vi.mock("./hosted-saas-policy.js", () => ({
  workerSharedLlmAllowed: vi.fn(() => true),
}));

import {
  isSummarizableAttachment,
  summarizeMessageAttachments,
} from "./attachment-file-summary.js";

function createEnv({ rows = [], objects = {}, attachmentsBound = true } = {}) {
  const updated = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async all() {
                if (sql.includes("FROM attachments")) return { results: rows };
                return { results: [] };
              },
              async run() {
                if (sql.includes("UPDATE attachments")) updated.push(args);
                return { meta: {} };
              },
            };
          },
        };
      },
    },
  };
  if (attachmentsBound) {
    env.ATTACHMENTS = {
      async get(key) {
        const entry = objects[key];
        if (!entry) return null;
        return {
          async arrayBuffer() {
            return new TextEncoder().encode(entry).buffer;
          },
        };
      },
    };
  }
  return { env, updated };
}

describe("attachment-file-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatCompletionMock.mockResolvedValue({ ok: true, content: "A short summary." });
  });

  it("detects text-like attachments only", () => {
    expect(isSummarizableAttachment({ contentType: "text/plain", sizeBytes: 10 })).toBe(true);
    expect(isSummarizableAttachment({ contentType: "application/json", sizeBytes: 10 })).toBe(true);
    expect(isSummarizableAttachment({ contentType: "image/png", sizeBytes: 10 })).toBe(false);
    expect(isSummarizableAttachment({ contentType: "", sizeBytes: 10 })).toBe(false);
    expect(isSummarizableAttachment({ contentType: "text/plain", sizeBytes: 999_999 })).toBe(false);
  });

  it("summarizes own-project text attachments and skips foreign or non-text rows", async () => {
    const { env, updated } = createEnv({
      rows: [
        {
          id: 1,
          url: "/attachments/p1/up/notes.txt",
          name: "notes.txt",
          content_type: "text/plain",
          size_bytes: 10,
        },
        {
          id: 2,
          url: "/attachments/p2/up/other.txt",
          name: "other.txt",
          content_type: "text/plain",
          size_bytes: 10,
        },
        {
          id: 3,
          url: "/attachments/p1/up/photo.png",
          name: "photo.png",
          content_type: "image/png",
          size_bytes: 10,
        },
      ],
      objects: { "p1/up/notes.txt": "hello file", "p2/up/other.txt": "foreign" },
    });

    const result = await summarizeMessageAttachments(env, { projectId: "p1", messageId: 7 });
    expect(result).toEqual({ summarized: 1 });
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(updated).toEqual([["A short summary.", 1, "p1"]]);
  });

  it("stays quiet when the LLM fails or the binding is missing", async () => {
    chatCompletionMock.mockResolvedValue({ ok: false });
    const failed = createEnv({
      rows: [
        {
          id: 1,
          url: "/attachments/p1/up/notes.txt",
          name: "notes.txt",
          content_type: "text/plain",
          size_bytes: 10,
        },
      ],
      objects: { "p1/up/notes.txt": "hello" },
    });
    expect(await summarizeMessageAttachments(failed.env, { projectId: "p1", messageId: 7 })).toEqual({
      summarized: 0,
    });
    expect(failed.updated).toEqual([]);

    const unbound = createEnv({ attachmentsBound: false });
    expect(
      await summarizeMessageAttachments(unbound.env, { projectId: "p1", messageId: 7 }),
    ).toEqual({ summarized: 0 });
  });
});
