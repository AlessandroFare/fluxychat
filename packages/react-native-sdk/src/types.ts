export interface FluxyChatConfig {
  apiUrl: string;
  wsUrl: string;
  projectId: string;
  token: string;
  debug?: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  kind: 'text' | 'image' | 'file' | 'system' | 'ai' | 'poll' | 'form';
  metadata?: Record<string, unknown>;
  replyToId?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
}

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
  type: 'message' | 'typing' | 'presence' | 'read' | 'reaction' | 'room_update' | 'error';
  data: unknown;
  roomId?: string;
  timestamp: string;
}

export type EventHandler = (event: ChatEvent) => void;

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
