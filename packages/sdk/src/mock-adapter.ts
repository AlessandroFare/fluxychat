/**
 * P22-F11: Mock adapter for testing.
 * Provides a simple in-memory adapter for unit and integration tests.
 */

import type {
  Author,
  FormattedMessage,
  FormatConverter,
  RawMessage,
  ThreadAdapter,
  UserInfo,
} from "./adapter-types";

class MockFormatConverter implements FormatConverter {
  toFormatted(raw: unknown, threadId: string): FormattedMessage {
    const data = raw as { id?: string; content?: string; author?: string };
    return {
      id: data.id ?? crypto.randomUUID(),
      threadId,
      author: {
        userId: data.author ?? "mock-user",
        userName: data.author ?? "mock",
        fullName: "Mock User",
        isBot: false,
        isMe: false,
      },
      content: data.content ?? "",
      metadata: {
        dateSent: new Date(),
        edited: false,
      },
      raw,
    };
  }

  toRaw(formatted: FormattedMessage): unknown {
    return {
      id: formatted.id,
      content: formatted.content,
      author: formatted.author.userId,
    };
  }
}

export class MockAdapter implements ThreadAdapter {
  name = "mock";
  displayName = "Mock Adapter";
  version = "1.0.0";
  format = new MockFormatConverter();

  private messages = new Map<string, RawMessage[]>();

  async postMessage(threadId: string, content: string): Promise<RawMessage> {
    const msg: RawMessage = {
      id: crypto.randomUUID(),
      raw: { content, author: "mock-user", timestamp: Date.now() },
      threadId,
    };
    const existing = this.messages.get(threadId) ?? [];
    existing.push(msg);
    this.messages.set(threadId, existing);
    return msg;
  }

  async editMessage(threadId: string, messageId: string, content: string): Promise<RawMessage> {
    const msgs = this.messages.get(threadId) ?? [];
    const msg = msgs.find((m) => m.id === messageId);
    if (msg) {
      msg.raw = { ...(msg.raw as Record<string, unknown>), content, edited: true };
    }
    return msg ?? { id: messageId, raw: { content, edited: true }, threadId };
  }

  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    const msgs = this.messages.get(threadId) ?? [];
    this.messages.set(
      threadId,
      msgs.filter((m) => m.id !== messageId),
    );
  }

  async addReaction(_threadId: string, _messageId: string, _emoji: string): Promise<void> {}

  async removeReaction(_threadId: string, _messageId: string, _emoji: string): Promise<void> {}

  async startTyping(_threadId: string): Promise<void> {}

  async fetchMessages(threadId: string, limit = 50): Promise<RawMessage[]> {
    const msgs = this.messages.get(threadId) ?? [];
    return msgs.slice(-limit);
  }

  async fetchThread(_threadId: string): Promise<unknown> {
    return {};
  }

  async fetchChannelInfo(_channelId: string): Promise<unknown> {
    return {};
  }

  async getUser(userId: string): Promise<UserInfo> {
    return {
      userId,
      userName: userId,
      fullName: `User ${userId}`,
      isBot: false,
    };
  }
}

export function createMockAdapter(): MockAdapter {
  return new MockAdapter();
}
