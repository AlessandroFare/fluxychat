/**
 * NW-112 — MockAdapter with full lifecycle APIs for tests & conformance.
 */
import { Adapter, registerAdapter } from "./adapter.js";

/**
 * @typedef {{ id: string, text?: string, content?: string, authorId?: string, parentId?: string|null, createdAt: string }} MockChannelMessage
 * @typedef {{ id: string, channelId: string, rootMessageId: string, replyCount: number, lastReplyAt: string|null }} MockThreadSummary
 */

export class MockAdapter extends Adapter {
  name = "mock";
  displayName = "Mock Adapter";
  version = "1.0.0";

  constructor() {
    super();
    /** @type {Map<string, Array<{id: string, raw: object, threadId: string}>>} */
    this.messages = new Map();
    /** @type {Map<string, MockChannelMessage[]>} */
    this.channelMessages = new Map();
    /** @type {Map<string, MockThreadSummary[]>} */
    this.channelThreads = new Map();
    this.disconnected = false;
    this.disconnectCount = 0;
  }

  async disconnect() {
    this.disconnected = true;
    this.disconnectCount += 1;
  }

  async postMessage(threadId, content) {
    this.#assertConnected();
    const text =
      typeof content === "string"
        ? content
        : content?.text || content?.content || JSON.stringify(content);
    const msg = {
      id: crypto.randomUUID(),
      raw: { content: text, author: "mock-user", timestamp: Date.now() },
      threadId,
    };
    const existing = this.messages.get(threadId) || [];
    existing.push(msg);
    this.messages.set(threadId, existing);
    return msg;
  }

  async postChannelMessage(channelId, message) {
    this.#assertConnected();
    const text =
      typeof message === "string"
        ? message
        : message?.text || message?.content || this.formatConverter?.renderPostable?.(message) || "";
    const row = {
      id: crypto.randomUUID(),
      text: String(text),
      content: String(text),
      authorId: message?.authorId || "mock-user",
      parentId: message?.parentId ?? null,
      createdAt: new Date().toISOString(),
    };
    const list = this.channelMessages.get(channelId) || [];
    list.push(row);
    this.channelMessages.set(channelId, list);

    if (row.parentId) {
      const threads = this.channelThreads.get(channelId) || [];
      let thread = threads.find((t) => t.rootMessageId === row.parentId || t.id === row.parentId);
      if (!thread) {
        thread = {
          id: `thread_${row.parentId}`,
          channelId,
          rootMessageId: String(row.parentId),
          replyCount: 0,
          lastReplyAt: null,
        };
        threads.push(thread);
        this.channelThreads.set(channelId, threads);
      }
      thread.replyCount += 1;
      thread.lastReplyAt = row.createdAt;
    }

    return { id: row.id, channelId, raw: row };
  }

  async fetchChannelMessages(channelId, options = {}) {
    this.#assertConnected();
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const all = this.channelMessages.get(channelId) || [];
    let start = 0;
    if (options.cursor) {
      const idx = all.findIndex((m) => m.id === options.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const slice = all.slice(start, start + limit);
    const nextCursor =
      start + limit < all.length && slice.length
        ? slice[slice.length - 1].id
        : undefined;
    return {
      messages: slice.map((m) => ({
        id: m.id,
        text: m.text,
        content: m.content,
        authorId: m.authorId,
        parentId: m.parentId,
        createdAt: m.createdAt,
      })),
      nextCursor,
      hasMore: Boolean(nextCursor),
    };
  }

  async listThreads(channelId, options = {}) {
    this.#assertConnected();
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const all = this.channelThreads.get(channelId) || [];
    let start = 0;
    if (options.cursor) {
      const idx = all.findIndex((t) => t.id === options.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const slice = all.slice(start, start + limit);
    const nextCursor =
      start + limit < all.length && slice.length
        ? slice[slice.length - 1].id
        : undefined;
    return {
      threads: slice.map((t) => ({
        id: t.id,
        channelId: t.channelId,
        rootMessage: { id: t.rootMessageId },
        replyCount: t.replyCount,
        lastReplyAt: t.lastReplyAt,
      })),
      nextCursor,
    };
  }

  async editMessage(threadId, messageId, content) {
    this.#assertConnected();
    const msgs = this.messages.get(threadId) || [];
    const msg = msgs.find((m) => m.id === messageId);
    if (msg) {
      msg.raw = { ...msg.raw, content, edited: true };
    }
    return msg || { id: messageId, raw: { content, edited: true }, threadId };
  }

  async deleteMessage(threadId, messageId) {
    this.#assertConnected();
    const msgs = this.messages.get(threadId) || [];
    this.messages.set(
      threadId,
      msgs.filter((m) => m.id !== messageId),
    );
  }

  async addReaction(_threadId, _messageId, _emoji) {}
  async removeReaction(_threadId, _messageId, _emoji) {}
  async startTyping(_threadId) {}

  async fetchMessages(threadId, limit = 50) {
    this.#assertConnected();
    const msgs = this.messages.get(threadId) || [];
    return msgs.slice(-limit);
  }

  async fetchThread(_threadId) {
    return {};
  }

  async fetchChannelInfo(channelId) {
    return {
      id: channelId,
      name: channelId,
      isDM: false,
      memberCount: 0,
      channelVisibility: "public",
    };
  }

  async getUser(userId) {
    return {
      userId,
      userName: userId,
      fullName: `User ${userId}`,
      isBot: false,
    };
  }

  #assertConnected() {
    if (this.disconnected) {
      throw new Error("mock_adapter_disconnected");
    }
  }
}

export function createMockAdapter() {
  return new MockAdapter();
}

export function registerMockAdapter() {
  registerAdapter("mock", new MockAdapter());
}
