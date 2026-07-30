import { describe, expect, it } from "vitest";
import { pruneMessages } from "./prune-messages";
import type { AIMessage } from "./providers";

const sys: AIMessage = { role: "system", content: "You are a helpful assistant." };
const u1: AIMessage = { role: "user", content: "Hello" };
const a1: AIMessage = { role: "assistant", content: "Hi there!" };
const u2: AIMessage = { role: "user", content: "What is the weather?" };
const a2: AIMessage = { role: "assistant", content: "It is sunny." };
const t1: AIMessage = { role: "tool", content: "tool_result_1" };

describe("pruneMessages", () => {
  it("returns all messages when no limits", () => {
    expect(pruneMessages({ messages: [u1, a1] })).toEqual([u1, a1]);
  });

  it("removes specified roles", () => {
    const result = pruneMessages({ messages: [sys, u1, a1, t1], removeRoles: ["tool"] });
    expect(result).toEqual([sys, u1, a1]);
  });

  it("does not remove system via removeRoles", () => {
    const result = pruneMessages({ messages: [sys, u1], removeRoles: ["system"] });
    expect(result).toContainEqual(sys);
  });

  it("removes empty messages when removeEmpty is true", () => {
    const empty: AIMessage = { role: "user", content: "" };
    const result = pruneMessages({ messages: [u1, empty, a1], removeEmpty: true });
    expect(result).toEqual([u1, a1]);
  });

  it("preserves system message when trimming by maxMessages", () => {
    const result = pruneMessages({ messages: [sys, u1, a1, u2, a2], maxMessages: 3 });
    expect(result).toContainEqual(sys);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("keeps recent messages when trimming by maxMessages", () => {
    const result = pruneMessages({ messages: [sys, u1, a1, u2, a2], maxMessages: 3 });
    // system + last 2
    expect(result[0]).toEqual(sys);
    expect(result).toContainEqual(u2);
    expect(result).toContainEqual(a2);
  });

  it("preserves last N messages with preserveLast", () => {
    const result = pruneMessages({ messages: [sys, u1, a1, u2, a2], maxMessages: 3, preserveLast: 1 });
    // system + last 2 (keepCount = max(1, 3-1) = 2)
    expect(result).toEqual([sys, u2, a2]);
  });

  it("trims by maxChars", () => {
    const long: AIMessage = { role: "user", content: "a".repeat(500) };
    const result = pruneMessages({ messages: [sys, long, u2, a2], maxChars: 100 });
    // system should be preserved, recent messages up to 100 chars
    expect(result[0]).toEqual(sys);
    expect(result.filter((m) => m.role === "user" && m.content === "a".repeat(500))).toHaveLength(0);
  });

  it("handles empty messages array", () => {
    expect(pruneMessages({ messages: [] })).toEqual([]);
  });

  it("handles system-only messages", () => {
    expect(pruneMessages({ messages: [sys], maxMessages: 0 })).toEqual([sys]);
  });

  it("removeEmpty keeps system message even if empty", () => {
    const empty: AIMessage = { role: "system", content: "" };
    const result = pruneMessages({ messages: [empty, u1, a1], removeEmpty: true });
    expect(result).toContainEqual(empty);
  });
});
