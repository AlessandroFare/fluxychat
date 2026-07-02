export interface FluxyChatConfig {
  apiUrl: string;
  wsUrl: string;
  baseUrl?: string;
  projectId: string;
  token: string;
  userId?: string;
  debug?: boolean;
}

export interface FluxyChatAttachment {
  kind: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  kind: 'text' | 'image' | 'file' | 'system' | 'ai' | 'poll' | 'form' | 'voice';
  metadata?: Record<string, unknown>;
  replyToId?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  clientMessageId?: string;
  data?: unknown;
  attachments?: FluxyChatAttachment[];
}

export interface FluxyChatMessage extends Message {}

export interface Room {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  type: 'direct' | 'group' | 'channel' | 'ai';
  memberCount: number;
  lastMessageAt?: string;
  createdAt: string;
}

export interface FluxyChatRoom extends Room {}

export interface User {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeenAt?: string;
}

export interface PresenceState {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  cursor?: { x: number; y: number };
  typing?: boolean;
  lastSeenAt: string;
}

export interface ChatEvent {
  type: string;
  data: unknown;
  roomId?: string;
  timestamp: string;
  // Common inline fields used by hooks
  id?: number | string;
  userId?: string;
  content?: string;
  editedAt?: string;
  deletedAt?: string;
  streaming?: boolean;
  messageId?: number;
  emoji?: string;
  op?: string;
  isTyping?: boolean;
  hard?: boolean;
  online?: boolean;
  users?: unknown[];
  messages?: Message[];
}

export type FluxyChatEvent = ChatEvent;

export type EventHandler = (...args: any[]) => void;

export interface SendMessageOptions {
  content: string;
  kind?: Message['kind'];
  metadata?: Record<string, unknown>;
  replyToId?: string;
}

export interface PaginationOptions {
  limit?: number;
  before?: string;
  after?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface FluxyInAppNotification {
  id: string;
  type: string;
  title?: string;
  body?: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface FluxyChatAgentRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  content?: string;
  toolCalls?: unknown[];
  inputTokens?: number;
  outputTokens?: number;
  createdAt: string;
}

export interface FluxyWebSocketConnectOptions {
  roomId: string;
  token: string;
  replay?: string;
  historyLimit?: number;
  replayLimit?: number;
  presenceInfo?: Record<string, unknown>;
  cache?: string;
}
