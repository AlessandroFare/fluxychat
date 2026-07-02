/**
 * P22-F11: Mock Adapter for Testing
 * Simple in-memory adapter for unit and integration tests.
 */

import { Adapter, registerAdapter } from "./adapter.js";

export class MockAdapter extends Adapter {
  name = "mock";
  displayName = "Mock Adapter";
  version = "1.0.0";

  constructor() {
    super();
    this.messages = new Map();
  }

  async postMessage(threadId, content) {
    const msg = {
      id: crypto.randomUUID(),
      raw: { content, author: "mock-user", timestamp: Date.now() },
      threadId,
    };
    const existing = this.messages.get(threadId) || [];
    existing.push(msg);
    this.messages.set(threadId, existing);
    return msg;
  }

  async editMessage(threadId, messageId, content) {
    const msgs = this.messages.get(threadId) || [];
    const msg = msgs.find((m) => m.id === messageId);
    if (msg) {
      msg.raw = { ...msg.raw, content, edited: true };
    }
    return msg || { id: messageId, raw: { content, edited: true }, threadId };
  }

  async deleteMessage(threadId, messageId) {
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
    const msgs = this.messages.get(threadId) || [];
    return msgs.slice(-limit);
  }

  async fetchThread(_threadId) {
    return {};
  }

  async fetchChannelInfo(_channelId) {
    return {};
  }

  async getUser(userId) {
    return {
      userId,
      userName: userId,
      fullName: `User ${userId}`,
      isBot: false,
    };
  }
}

export function createMockAdapter() {
  return new MockAdapter();
}

export function registerMockAdapter() {
  registerAdapter("mock", new MockAdapter());
}
