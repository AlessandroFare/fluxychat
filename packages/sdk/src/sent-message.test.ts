import { describe, it, expect, vi } from "vitest";
import { createSentMessage } from "./sent-message";
import type { ThreadAdapter } from "./adapter-types";

function mockAdapter(): ThreadAdapter {
  return {
    name: "test",
    displayName: "Test",
    version: "1.0",
    format: { toFormatted: vi.fn(), toRaw: vi.fn() },
    postMessage: vi.fn().mockResolvedValue({ id: "msg-1", threadId: "thread:1", raw: undefined }),
    editMessage: vi.fn().mockResolvedValue({ id: "msg-1", threadId: "thread:1", raw: undefined }),
    deleteMessage: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    startTyping: vi.fn(),
    fetchMessages: vi.fn(),
    fetchThread: vi.fn(),
    fetchChannelInfo: vi.fn(),
    getUser: vi.fn(),
  };
}

describe("SentMessage", () => {
  it("stores id, threadId, content", () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    expect(msg.id).toBe("msg-1");
    expect(msg.threadId).toBe("thread:1");
    expect(msg.content).toBe("hello");
  });

  it("edit calls adapter.editMessage and returns new SentMessage", async () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    const edited = await msg.edit("world");
    expect(adapter.editMessage).toHaveBeenCalledWith("thread:1", "msg-1", "world");
    expect(edited.content).toBe("world");
    expect(edited.id).toBe("msg-1");
  });

  it("delete calls adapter.deleteMessage", async () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    await msg.delete();
    expect(adapter.deleteMessage).toHaveBeenCalledWith("thread:1", "msg-1");
  });

  it("addReaction calls adapter.addReaction", async () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    await msg.addReaction("+1");
    expect(adapter.addReaction).toHaveBeenCalledWith("thread:1", "msg-1", "+1");
  });

  it("removeReaction calls adapter.removeReaction", async () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    await msg.removeReaction("+1");
    expect(adapter.removeReaction).toHaveBeenCalledWith("thread:1", "msg-1", "+1");
  });

  it("chains edit after edit", async () => {
    const adapter = mockAdapter();
    const msg = createSentMessage(adapter, "thread:1", "msg-1", "hello");
    const edited = await (await msg.edit("world")).edit("!");
    expect(adapter.editMessage).toHaveBeenCalledTimes(2);
    expect(edited.content).toBe("!");
  });
});
