import { describe, it, expect, vi } from "vitest";
import { postEphemeral } from "./ephemeral";
import type { ThreadAdapter } from "./adapter-types";

function mockAdapter(overrides?: Partial<ThreadAdapter>): ThreadAdapter {
  return {
    name: "test",
    displayName: "Test",
    version: "1.0",
    format: { toFormatted: vi.fn(), toRaw: vi.fn() },
    postMessage: vi.fn().mockResolvedValue({ id: "dm-1", threadId: "dm-thread", raw: undefined }),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    startTyping: vi.fn(),
    fetchMessages: vi.fn(),
    fetchThread: vi.fn(),
    fetchChannelInfo: vi.fn(),
    getUser: vi.fn(),
    ...overrides,
  };
}

describe("postEphemeral", () => {
  it("calls adapter.postEphemeral when available", async () => {
    const adapter = mockAdapter({
      postEphemeral: vi.fn().mockResolvedValue({ id: "ep-1", threadId: "thread:1" }),
    });
    const result = await postEphemeral(adapter, "thread:1", "user:1", "hello");
    expect(result).toEqual({ id: "ep-1", threadId: "thread:1", usedFallback: false });
    expect(adapter.postEphemeral).toHaveBeenCalledWith("thread:1", "user:1", "hello");
  });

  it("falls back to DM when adapter has no postEphemeral", async () => {
    const adapter = mockAdapter({
      openDM: vi.fn().mockResolvedValue("dm-thread"),
    });
    const result = await postEphemeral(adapter, "thread:1", "user:1", "hello");
    expect(result).toEqual({ id: "dm-1", threadId: "dm-thread", usedFallback: true });
    expect(adapter.openDM).toHaveBeenCalledWith("user:1");
    expect(adapter.postMessage).toHaveBeenCalledWith("dm-thread", "hello");
  });

  it("returns null when neither postEphemeral nor openDM is available", async () => {
    const adapter = mockAdapter();
    const result = await postEphemeral(adapter, "thread:1", "user:1", "hello");
    expect(result).toBeNull();
  });

  it("returns null when fallbackToDM is false and no postEphemeral", async () => {
    const adapter = mockAdapter({ openDM: vi.fn() });
    const result = await postEphemeral(adapter, "thread:1", "user:1", "hello", { fallbackToDM: false });
    expect(result).toBeNull();
    expect(adapter.openDM).not.toHaveBeenCalled();
  });

  it("prefers postEphemeral over DM fallback", async () => {
    const adapter = mockAdapter({
      postEphemeral: vi.fn().mockResolvedValue({ id: "ep-1", threadId: "thread:1" }),
      openDM: vi.fn(),
    });
    const result = await postEphemeral(adapter, "thread:1", "user:1", "hello", { fallbackToDM: false });
    expect(result).toEqual({ id: "ep-1", threadId: "thread:1", usedFallback: false });
    expect(adapter.openDM).not.toHaveBeenCalled();
  });
});
