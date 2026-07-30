/**
 * P22-A1: Adapter type definitions for multi-platform integration.
 * TypeScript mirrors of the JSDoc types in worker/src/lib/adapter.js.
 */

export type LockScope = "thread" | "channel";

export type ChannelVisibility = "private" | "workspace" | "external" | "unknown";

export interface Author {
  userId: string;
  userName: string;
  fullName: string;
  isBot: boolean | "unknown";
  isMe: boolean;
}

export interface UserInfo {
  userId: string;
  userName: string;
  fullName: string;
  isBot: boolean;
  avatarUrl?: string;
  email?: string;
}

export interface MessageMetadata {
  dateSent: Date;
  edited: boolean;
  editedAt?: Date;
}

export interface RawMessage {
  id: string;
  raw: unknown;
  threadId: string;
}

export interface FormattedMessage {
  id: string;
  threadId: string;
  author: Author;
  content: string;
  metadata: MessageMetadata;
  raw?: unknown;
}

export interface FormatConverter {
  toFormatted(raw: unknown, threadId: string): FormattedMessage;
  toRaw(formatted: FormattedMessage): unknown;
}

export interface AdapterEphemeralResult {
  id: string;
  threadId: string;
}

export interface EphemeralMessage extends AdapterEphemeralResult {
  usedFallback: boolean;
}

export interface PostEphemeralOptions {
  fallbackToDM?: boolean;
}

export interface ThreadAdapter {
  name: string;
  displayName: string;
  version: string;
  format: FormatConverter;
  postMessage(threadId: string, content: string): Promise<RawMessage>;
  editMessage(threadId: string, messageId: string, content: string): Promise<RawMessage>;
  deleteMessage(threadId: string, messageId: string): Promise<void>;
  addReaction(threadId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(threadId: string, messageId: string, emoji: string): Promise<void>;
  startTyping(threadId: string): Promise<void>;
  fetchMessages(threadId: string, limit?: number, cursor?: string): Promise<RawMessage[]>;
  fetchThread(threadId: string): Promise<unknown>;
  fetchChannelInfo(channelId: string): Promise<unknown>;
  getUser(userId: string): Promise<UserInfo>;
  postEphemeral?(threadId: string, userId: string, content: string): Promise<AdapterEphemeralResult>;
  openDM?(userId: string): Promise<string>;
}
