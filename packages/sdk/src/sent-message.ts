import type { ThreadAdapter } from "./adapter-types";

export interface SentMessage {
  id: string;
  threadId: string;
  content: string;
  edit(newContent: string): Promise<SentMessage>;
  delete(): Promise<void>;
  addReaction(emoji: string): Promise<void>;
  removeReaction(emoji: string): Promise<void>;
}

export function createSentMessage(
  adapter: ThreadAdapter,
  threadId: string,
  messageId: string,
  content: string,
): SentMessage {
  return {
    id: messageId,
    threadId,
    content,

    async edit(newContent: string): Promise<SentMessage> {
      const result = await adapter.editMessage(threadId, messageId, newContent);
      return createSentMessage(adapter, threadId, result.id, newContent);
    },

    async delete(): Promise<void> {
      await adapter.deleteMessage(threadId, messageId);
    },

    async addReaction(emoji: string): Promise<void> {
      await adapter.addReaction(threadId, messageId, emoji);
    },

    async removeReaction(emoji: string): Promise<void> {
      await adapter.removeReaction(threadId, messageId, emoji);
    },
  };
}
