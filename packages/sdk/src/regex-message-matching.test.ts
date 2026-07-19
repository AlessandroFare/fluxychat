import { describe, it, expect, vi } from "vitest";
import { createMessagePatternMatcher } from "./regex-message-matching";
import type { FluxyChatEvent } from "./index";

function messageEvent(overrides?: Partial<{ id: number; roomId: string; userId: string; content: string }>): Extract<FluxyChatEvent, { type: "message" }> {
  return {
    type: "message",
    id: overrides?.id ?? 1,
    roomId: overrides?.roomId ?? "room:1",
    userId: overrides?.userId ?? "user:1",
    content: overrides?.content ?? "",
    createdAt: new Date().toISOString(),
  } as Extract<FluxyChatEvent, { type: "message" }>;
}

function nonMessageEvent(): FluxyChatEvent {
  return { type: "streamState", messageId: 1, roomId: "room:1", userId: "user:1", content: "", createdAt: "", streaming: false };
}

describe("createMessagePatternMatcher", () => {
  it("returns 0 when no patterns registered", () => {
    const m = createMessagePatternMatcher();
    expect(m.match(messageEvent({ content: "hello" }))).toBe(0);
  });

  it("matches a simple regex pattern", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/^hello/, handler);

    const matched = m.match(messageEvent({ content: "hello world" }));

    expect(matched).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes the message and match result to the handler", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/^!(help|status)/, handler);

    const evt = messageEvent({ content: "!help me please", roomId: "room:2", userId: "user:7" });
    m.match(evt);

    expect(handler).toHaveBeenCalledTimes(1);
    const [msg, match] = handler.mock.calls[0];
    expect(msg.roomId).toBe("room:2");
    expect(msg.userId).toBe("user:7");
    expect(msg.content).toBe("!help me please");
    expect(match[1]).toBe("help");
  });

  it("does not match when pattern does not match", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/^!help/, handler);

    const matched = m.match(messageEvent({ content: "just a normal message" }));

    expect(matched).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 0 and skips handlers for non-message events", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/.*/, handler);

    const matched = m.match(nonMessageEvent());

    expect(matched).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple patterns on the same event", () => {
    const m = createMessagePatternMatcher();
    const h1 = vi.fn();
    const h2 = vi.fn();
    m.onNewMessage(/hello/, h1);
    m.onNewMessage(/world/, h2);

    const matched = m.match(messageEvent({ content: "hello world" }));

    expect(matched).toBe(2);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("calls all matching patterns even if one is a subset of another", () => {
    const m = createMessagePatternMatcher();
    const h1 = vi.fn();
    const h2 = vi.fn();
    m.onNewMessage(/^!/, h1);
    m.onNewMessage(/^!help/, h2);

    const matched = m.match(messageEvent({ content: "!help" }));

    expect(matched).toBe(2);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("removes a specific handler", () => {
    const m = createMessagePatternMatcher();
    const h1 = vi.fn();
    const h2 = vi.fn();
    m.onNewMessage(/hello/, h1);
    m.onNewMessage(/hello/, h2);

    const removed = m.removeHandler(/hello/, h1);
    expect(removed).toBe(true);

    m.match(messageEvent({ content: "hello" }));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("returns false when removing non-existent handler", () => {
    const m = createMessagePatternMatcher();
    const h = vi.fn();

    expect(m.removeHandler(/nomatch/, h)).toBe(false);
    expect(m.removeHandler(/never/, vi.fn())).toBe(false);
  });

  it("only removes the exact pattern+handler pair", () => {
    const m = createMessagePatternMatcher();
    const h = vi.fn();
    m.onNewMessage(/hello/, h);
    m.onNewMessage(/world/, h);

    m.removeHandler(/hello/, h);

    expect(m.getPatterns()).toHaveLength(1);
    expect(m.getPatterns()[0].pattern.source).toBe("world");
  });

  it("lists registered patterns via getPatterns", () => {
    const m = createMessagePatternMatcher();
    m.onNewMessage(/^hello/, vi.fn(), { label: "greet", description: "Matches greetings" });
    m.onNewMessage(/^bye/, vi.fn(), { label: "farewell" });

    const patterns = m.getPatterns();
    expect(patterns).toHaveLength(2);
    expect(patterns[0].pattern.source).toBe("^hello");
    expect(patterns[0].label).toBe("greet");
    expect(patterns[0].description).toBe("Matches greetings");
    expect(patterns[1].label).toBe("farewell");
  });

  it("clears all patterns", () => {
    const m = createMessagePatternMatcher();
    m.onNewMessage(/hello/, vi.fn());
    m.onNewMessage(/world/, vi.fn());
    expect(m.getPatterns()).toHaveLength(2);

    m.clear();
    expect(m.getPatterns()).toHaveLength(0);

    const matched = m.match(messageEvent({ content: "hello" }));
    expect(matched).toBe(0);
  });

  it("handles async handlers without awaiting them", async () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn().mockResolvedValue(undefined);

    m.onNewMessage(/test/, handler);
    const matched = m.match(messageEvent({ content: "test" }));

    expect(matched).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(handler.mock.results[0].value).resolves.toBeUndefined();
  });

  it("does not throw if an async handler rejects", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn().mockRejectedValue(new Error("handler error"));

    m.onNewMessage(/boom/, handler);
    expect(() => m.match(messageEvent({ content: "boom"}))).not.toThrow();
  });

  it("matches with case-insensitive flag", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/^hello/i, handler);

    m.match(messageEvent({ content: "HELLO there" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches pattern that appears mid-content", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/world/, handler);

    m.match(messageEvent({ content: "hello world!" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("preserves match groups in the RegExpExecArray", () => {
    const m = createMessagePatternMatcher();
    const handler = vi.fn();
    m.onNewMessage(/^(\w+) (\d+)/, handler);

    m.match(messageEvent({ content: "score 42"}));
    const [, action, num] = handler.mock.calls[0][1];
    expect(action).toBe("score");
    expect(num).toBe("42");
  });
});
