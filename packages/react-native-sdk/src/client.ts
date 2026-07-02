import { FluxyChatConfig, Message, Room, User, EventHandler, SendMessageOptions, PaginationOptions, ChatEvent } from './types';
import { ApiClient } from './api-client';
import { WebSocketClient, ConnectionStatus } from './websocket-client';
import { FluxyChatMessageWithDelivery, createClientMessageId, createOptimisticMessage, applyServerMessageAck, markMessageDeliveryFailed } from './message-delivery';
import { sortMessagesChronological, mergeMessagesChronological, clampHistoryLimit } from './message-history';
import { decodeFluxyJwtPayload } from './jwt-utils';
import { trimTrailingSlashes } from './url-utils';

export class FluxyChatClient {
  private config: FluxyChatConfig;
  private api: ApiClient;
  private ws: WebSocketClient;
  private currentRoomId: string | null = null;
  private rooms: Map<string, Room> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private e2eKeys: Map<string, string> = new Map();
  private userWs: WebSocket | null = null;
  private userHandlers: Map<string, Set<EventHandler>> = new Map();

  isAuthenticated(): boolean {
    return !!this.config.token;
  }

  get userId(): string | undefined {
    return this.config.userId;
  }

  fetchMessages(roomId: string, options?: { limit?: number; before?: string }): Promise<Message[]> {
    return Promise.resolve(this.getMessages(roomId));
  }

  constructor(config: FluxyChatConfig) {
    this.config = config;
    this.api = new ApiClient(config);
    this.ws = new WebSocketClient(config);
  }

  // Connection
  connect(roomId: string, options?: Record<string, unknown>): WebSocket {
    this.currentRoomId = roomId;
    return this.ws.connect(roomId);
  }

  disconnect(): void {
    this.ws.disconnect();
    this.currentRoomId = null;
  }

  get connectionStatus(): ConnectionStatus {
    return this.ws.status;
  }

  // Events
  on(event: string, handler: EventHandler): () => void {
    return this.ws.on(event, handler);
  }

  onMessage(handler: (message: Message) => void): () => void {
    return this.ws.on('message', handler as EventHandler);
  }

  onTyping(handler: (data: { userId: string; typing: boolean; roomId: string }) => void): () => void {
    return this.ws.on('typing', handler as EventHandler);
  }

  onPresence(handler: (data: { userId: string; status: string }) => void): () => void {
    return this.ws.on('presence', handler as EventHandler);
  }

  onConnectionChange(handler: (status: ConnectionStatus) => void): () => void {
    return this.ws.onStatusChange(handler);
  }

  onEdit(handler: (data: { id: number; roomId: string; content: string; editedAt: string; streaming?: boolean }) => void): () => void {
    return this.ws.on('edit', handler as EventHandler);
  }

  onReaction(handler: (data: { roomId: string; userId: string; messageId: number; emoji: string; op: string }) => void): () => void {
    return this.ws.on('reaction', handler as EventHandler);
  }

  onDelete(handler: (data: { id: number; roomId: string; userId: string; deletedAt: string }) => void): () => void {
    return this.ws.on('delete', handler as EventHandler);
  }

  onStreamState(handler: (data: { messageId: number; roomId: string; userId: string; content: string; streaming: boolean }) => void): () => void {
    return this.ws.on('streamState', handler as EventHandler);
  }

  // Rooms
  async listRooms(options?: PaginationOptions): Promise<Room[]> {
    const rooms = await this.api.listRooms(options);
    rooms.forEach((room) => this.rooms.set(room.id, room));
    return rooms;
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = await this.api.getRoom(roomId);
    this.rooms.set(room.id, room);
    return room;
  }

  async createRoom(name: string, type?: Room['type']): Promise<Room> {
    const room = await this.api.createRoom(name, type);
    this.rooms.set(room.id, room);
    return room;
  }

  async updateRoom(roomId: string, data: Partial<Room>): Promise<Room> {
    const room = await this.api.updateRoom(roomId, data);
    this.rooms.set(room.id, room);
    return room;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.api.deleteRoom(roomId);
    this.rooms.delete(roomId);
    this.messages.delete(roomId);
  }

  // Members
  async addMember(roomId: string, userId: string): Promise<void> {
    await this.api.addMember(roomId, userId);
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    await this.api.removeMember(roomId, userId);
  }

  async listMembers(roomId: string): Promise<User[]> {
    return this.api.listMembers(roomId);
  }

  // Messages
  async loadMessages(roomId: string, options?: PaginationOptions): Promise<Message[]> {
    const limit = clampHistoryLimit(options?.limit);
    const messages = await this.api.listMessages(roomId, { ...options, limit });
    const existing = this.messages.get(roomId) || [];
    this.messages.set(roomId, mergeMessagesChronological(existing as any, messages as any) as any);
    return messages;
  }

  async sendMessage(roomId: string, options: SendMessageOptions): Promise<Message> {
    const message = await this.api.sendMessage(roomId, options.content, options.kind, options.metadata);
    const existing = this.messages.get(roomId) || [];
    this.messages.set(roomId, [...existing, message]);
    return message;
  }

  sendOptimisticMessage(roomId: string, content: string, userId: string, parentId?: string | null): FluxyChatMessageWithDelivery {
    return createOptimisticMessage({ roomId, userId, content, clientMessageId: createClientMessageId(), parentId: parentId as any });
  }

  async editMessage(roomId: string, messageId: string, content: string): Promise<Message> {
    return this.api.editMessage(roomId, messageId, content);
  }

  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    await this.api.deleteMessage(roomId, messageId);
    const messages = this.messages.get(roomId) || [];
    this.messages.set(roomId, messages.filter((m) => m.id !== messageId));
  }

  getMessages(roomId: string): Message[] {
    return this.messages.get(roomId) || [];
  }

  // Reactions
  async addReaction(roomId: string, messageId: string, emoji: string): Promise<void> {
    await this.api.addReaction(roomId, messageId, emoji);
  }

  async removeReaction(roomId: string, messageId: string, emoji: string): Promise<void> {
    await this.api.removeReaction(roomId, messageId, emoji);
  }

  // Typing
  sendTyping(roomId: string, typing: boolean): void {
    this.ws.sendTyping(roomId, typing);
  }

  // Presence
  async getPresence(roomId: string): Promise<{ online: User[]; total: number }> {
    return this.api.getPresence(roomId);
  }

  sendPresence(roomId: string, status: string): void {
    this.ws.sendPresence(roomId, status);
  }

  // Read receipts
  sendReadReceipt(roomId: string, messageId: string): void {
    this.ws.sendReadReceipt(roomId, messageId);
  }

  // AI
  async invokeAgent(roomId: string, agentId: string, message: string): Promise<Message> {
    return this.api.invokeAgent(roomId, agentId, message);
  }

  // Search
  async searchMessages(query: string, roomId?: string): Promise<Message[]> {
    return this.api.searchMessages(query, roomId);
  }

  // Export
  async exportRoom(roomId: string, format?: 'json' | 'csv'): Promise<Blob> {
    return this.api.exportRoom(roomId, format);
  }

  // Typing users tracking
  getTypingUsers(roomId: string): string[] {
    return Array.from(this.typingUsers.get(roomId) || []);
  }

  // --- E2E Encryption ---
  async getRoomE2eKey(roomId: string): Promise<{ e2eEnabled: boolean; e2eKey?: string } | null> {
    try {
      const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/e2e-key`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ e2eEnabled: boolean; e2eKey?: string }>;
    } catch { return null; }
  }

  setE2eKey(roomId: string, key: string): void { this.e2eKeys.set(roomId, key); }
  getE2eKey(roomId: string): string | undefined { return this.e2eKeys.get(roomId); }

  // --- User Channel (push-style user events) ---
  connectUser(userId?: string): void {
    const uid = userId || this.config.token ? decodeFluxyJwtPayload(this.config.token).sub : undefined;
    if (!uid) return;
    const wsBase = this.config.wsUrl.replace(/^http/, 'ws');
    const url = new URL(`/ws/user/${encodeURIComponent(uid)}`, wsBase.endsWith('/') ? wsBase : `${wsBase}/`);
    url.searchParams.set('token', this.config.token);
    url.searchParams.set('userId', uid);
    this.userWs = new WebSocket(url.toString());
    this.userWs.onmessage = (ev) => {
      try {
        const event = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as ChatEvent;
        const handlers = this.userHandlers.get(event.type);
        handlers?.forEach((h) => h(event));
      } catch {}
    };
  }

  onUserEvent(event: string, handler: EventHandler): () => void {
    if (!this.userHandlers.has(event)) this.userHandlers.set(event, new Set());
    this.userHandlers.get(event)!.add(handler);
    return () => { this.userHandlers.get(event)?.delete(handler); };
  }

  disconnectUser(): void { this.userWs?.close(); this.userWs = null; }

  // --- Notifications ---
  async getNotifications(limit = 50): Promise<Array<{ id: number; kind: string; title: string; body?: string; room_id?: string; message_id?: number; read_at?: string; created_at: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications?limit=${limit}`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json() as { notifications?: unknown[] };
    return (body.notifications ?? []) as any;
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }

  // --- Web Push ---
  async registerWebPush(subscription: PushSubscription): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ subscription }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async unregisterWebPush(): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/push/unregister`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Digest ---
  async getDigestPreferences(): Promise<{ enabled: boolean; email: string | null } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/digest/preferences`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    const body = await res.json() as { preferences?: Record<string, unknown> };
    const p = body.preferences || {};
    return { enabled: Boolean(p.enabled), email: typeof p.email === 'string' ? p.email : null };
  }

  // --- Quiet Hours ---
  async getQuietHoursPreferences(): Promise<{ preferences: Record<string, unknown>; inQuietHours: boolean } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications/quiet-hours`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ preferences: Record<string, unknown>; inQuietHours: boolean }>;
  }

  // --- Inbox ---
  async getInbox(): Promise<{ mentions: unknown[]; unreadRooms: unknown[]; followUps: unknown[] } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/inbox`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Room REST helpers ---
  async fetchRoomMembers(roomId: string): Promise<Array<{ userId: string; role: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/members`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json() as { members?: unknown[] };
    return (body.members ?? []) as any;
  }

  async getRoomLive(roomId: string): Promise<{ online: number; members: Array<{ userId: string }> }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/live`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return { online: 0, members: [] };
    return res.json();
  }

  // --- Templates ---
  async listMessageTemplates(): Promise<Array<{ id: string; name: string; body: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/templates`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json() as { templates?: unknown[] };
    return (body.templates ?? []) as any;
  }

  // --- Voice Messages ---
  async sendVoiceMessage(roomId: string, audio: Blob, options?: { parentId?: string; durationMs?: number; clientMessageId?: string }): Promise<Message | null> {
    const form = new FormData();
    form.append('audio', audio, 'voice.webm');
    form.append('roomId', roomId);
    if (options?.parentId) form.append('parentId', options.parentId);
    if (options?.durationMs != null) form.append('durationMs', String(options.durationMs));
    if (options?.clientMessageId) form.append('clientMessageId', options.clientMessageId);
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/voice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
      body: form,
    });
    if (!res.ok) return null;
    const body = await res.json() as { message?: Message };
    return body.message ?? null;
  }

  // --- Reply Suggestions ---
  async suggestReplies(roomId: string, parentId?: string): Promise<string[]> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/suggest-replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ roomId, ...(parentId ? { parentId } : {}) }),
    });
    if (!res.ok) return [];
    const body = await res.json() as { suggestions?: string[] };
    return body.suggestions ?? [];
  }

  // --- Thread Summary ---
  async summarizeThread(messageId: string, roomId: string): Promise<{ summary: string; messageCount: number } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${encodeURIComponent(messageId)}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ roomId }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Watchlist ---
  async getWatchlist(): Promise<Array<{ type: string; targetId: string }>> {
    const uid = decodeFluxyJwtPayload(this.config.token).sub;
    if (!uid) return [];
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/users/${encodeURIComponent(uid)}/watchlist`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json() as { targets?: unknown[] };
    return (body.targets ?? []) as any;
  }

  async addWatchlistTarget(target: { type: string; targetId: string }): Promise<{ ok: boolean }> {
    const uid = decodeFluxyJwtPayload(this.config.token).sub;
    if (!uid) return { ok: false };
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/users/${encodeURIComponent(uid)}/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(target),
    });
    return res.ok ? res.json() : { ok: false };
  }

  async removeWatchlistTarget(target: { type: string; targetId: string }): Promise<{ ok: boolean }> {
    const uid = decodeFluxyJwtPayload(this.config.token).sub;
    if (!uid) return { ok: false };
    const url = `${trimTrailingSlashes(this.config.apiUrl)}/users/${encodeURIComponent(uid)}/watchlist?type=${target.type}&targetId=${target.targetId}`;
    const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${this.config.token}` } });
    return res.ok ? res.json() : { ok: false };
  }

  // --- SSE Fallback ---
  connectSSE(roomId: string): EventSource | null {
    if (!this.config.token) return null;
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/stream`, trimTrailingSlashes(this.config.apiUrl));
    url.searchParams.set('token', this.config.token);
    url.searchParams.set('userId', this.config.userId);
    return new EventSource(url.toString());
  }

  // --- Sign In (API key JWT minting) ---
  async signIn(options?: { userId?: string; roles?: string[]; ttlSeconds?: number }): Promise<{ token: string; userId: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Fluxy-Api-Key': this.config.token },
      body: JSON.stringify({ userId: options?.userId ?? this.userId, roles: options?.roles, ttlSeconds: options?.ttlSeconds }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Trigger Events ---
  async triggerEvents(options: { roomIds: string[]; name?: string; data?: unknown }): Promise<{ ok: boolean; triggered: string[] }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(options),
    });
    return res.ok ? res.json() : { ok: false, triggered: [] };
  }

  // --- User Events ---
  async triggerUserEvent(targetUserId: string, options: { name: string; data?: unknown }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/users/${encodeURIComponent(targetUserId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(options),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async terminateUserConnections(targetUserId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/users/${encodeURIComponent(targetUserId)}/connections`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Template CRUD ---
  async createMessageTemplate(name: string, body: string): Promise<{ id: string; name: string; body: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ name, body }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.template ?? null;
  }

  async updateMessageTemplate(templateId: string, patch: { name?: string; body?: string }): Promise<{ id: string; name: string; body: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/templates/${encodeURIComponent(templateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.template ?? null;
  }

  async deleteMessageTemplate(templateId: string): Promise<boolean> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok;
  }

  async renderMessageTemplate(options: { templateId?: string; body?: string; vars?: Record<string, unknown> }): Promise<string> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/templates/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ templateId: options.templateId, body: options.body, vars: options.vars, templateVars: options.vars }),
    });
    if (!res.ok) throw new Error(`renderMessageTemplate failed: ${res.status}`);
    const json = await res.json();
    return String(json.content ?? '');
  }

  // --- Activities ---
  async listActivities(options?: { limit?: number; roomId?: string }): Promise<Array<{ id: string; kind: string; roomId?: string; userId?: string; data?: unknown; createdAt: string }>> {
    const url = new URL('/activities', trimTrailingSlashes(this.config.apiUrl));
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.roomId) url.searchParams.set('roomId', options.roomId);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${this.config.token}` } });
    if (!res.ok) return [];
    const body = await res.json();
    return body.activities ?? [];
  }

  // --- Member Preferences ---
  async updateMemberPreferences(roomId: string, patch: { notifyEnabled?: boolean; preferences?: Record<string, unknown> }): Promise<{ userId: string; role: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/members/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.member ?? null;
  }

  // --- REST message helpers ---
  async createMessage(roomId: string, content: string, replyTo?: number | null): Promise<Message | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ roomId, content, replyTo: replyTo ?? null }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.message ?? null;
  }

  async editMessageRest(messageId: number, content: string): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessageRest(messageId: number): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }

  async sendReactionRest(messageId: number, emoji: string, op: 'add' | 'remove' = 'add'): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}/reactions`, {
      method: op === 'remove' ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ emoji }),
    });
  }

  async markReadRest(roomId: string, messageId: number): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ messageId }),
    });
  }

  // --- Inbox operations ---
  async snoozeRoom(roomId: string, options: { until?: string; minutes?: number; hours?: number }): Promise<{ ok: boolean; snoozeUntil?: string }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/inbox/rooms/${encodeURIComponent(roomId)}/snooze`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(options),
    });
    return res.ok ? res.json() : { ok: false };
  }

  async unsnoozeRoom(roomId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/inbox/rooms/${encodeURIComponent(roomId)}/snooze`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: false } : { ok: false };
  }

  async createInboxFollowUp(input: { roomId: string; messageId?: number; note?: string; dueAt?: string }): Promise<{ ok: boolean; id: string }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/inbox/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    return res.ok ? res.json() : { ok: false, id: '' };
  }

  async completeInboxFollowUp(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/inbox/follow-ups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ status: 'done' }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Agent Queue ---
  async getAgentQueue(options?: { status?: string; assignee?: string; limit?: number }): Promise<{ tasks: unknown[]; counts: Record<string, number> } | null> {
    const url = new URL('/agent-queue', trimTrailingSlashes(this.config.apiUrl));
    if (options?.status) url.searchParams.set('status', options.status);
    if (options?.assignee) url.searchParams.set('assignee', options.assignee);
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${this.config.token}` } });
    if (!res.ok) return null;
    return res.json();
  }

  async createAgentTask(input: { roomId: string; note?: string; priority?: number }): Promise<{ id: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    return res.ok ? res.json() : null;
  }

  async claimAgentTask(taskId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue/${encodeURIComponent(taskId)}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async resolveAgentTask(taskId: string, input: { status: string; disposition?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Room Handoff ---
  async getRoomHandoff(roomId: string): Promise<{ handoff: Record<string, unknown> } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/handoff`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async requestRoomHandoff(roomId: string, input?: { agentId?: string; note?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input ?? {}),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Feature Flags ---
  async getFeatureFlags(): Promise<{ flags: Record<string, boolean>; reconnectBackoff: { baseBackoffMs: number; maxBackoffMs: number } }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/client/feature-flags`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return { flags: {}, reconnectBackoff: { baseBackoffMs: 500, maxBackoffMs: 20000 } };
    return res.json();
  }

  // --- Upload ---
  async uploadFile(roomId: string, file: { name: string; type: string; size: number; data: Blob }): Promise<{ kind: string; url: string; name: string; sizeBytes: number } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${this.config.token}`, 'X-File-Name': file.name.slice(0, 255), 'X-Room-Id': roomId },
      body: file.data,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const f = json.file;
    return f?.url ? { kind: 'file', url: f.url, name: (f.name || file.name).slice(0, 255), sizeBytes: f.size ?? file.size } : null;
  }

  // --- Room Utilities ---
  async getRoomCatchUp(roomId: string): Promise<{ unreadCount: number; lastReadMessageId: number; firstUnreadMessageId: number | null }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/unread`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return { unreadCount: 0, lastReadMessageId: 0, firstUnreadMessageId: null };
    return res.json();
  }

  async pinMessage(roomId: string, messageId: number | null): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ messageId }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Notifications (with options) ---
  async listNotifications(options?: { limit?: number; unreadOnly?: boolean }): Promise<Array<{ id: number; kind: string; title: string; body?: string; room_id?: string; message_id?: number; read_at?: string; created_at: string }>> {
    const url = new URL('/notifications', trimTrailingSlashes(this.config.apiUrl));
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.unreadOnly) url.searchParams.set('unreadOnly', '1');
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${this.config.token}` } });
    if (!res.ok) return [];
    const body = await res.json();
    return body.notifications ?? [];
  }

  // --- Digest/QuietHours update ---
  async updateDigestPreferences(patch: { enabled?: boolean; email?: string | null }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/digest/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(patch),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async updateQuietHoursPreferences(patch: { enabled?: boolean; timezone?: string; quietStart?: string; quietEnd?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications/quiet-hours`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(patch),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async flushNotificationBatch(): Promise<{ ok: boolean; flushed: number }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/notifications/flush-batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? res.json() : { ok: false, flushed: 0 };
  }

  // --- Room Participants ---
  async getRoomParticipants(roomId: string): Promise<Array<{ userId: string; role: string; joinedAt: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/participants`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.participants ?? [];
  }

  // --- Agent Queue extras ---
  async releaseAgentTask(taskId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue/${encodeURIComponent(taskId)}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async getAgentDispositions(): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue/dispositions`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.dispositions ?? [];
  }

  async getAgentQueueStats(): Promise<{ total: number; pending: number; assigned: number; resolved: number }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agent-queue/stats`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return { total: 0, pending: 0, assigned: 0, resolved: 0 };
    return res.json();
  }

  // --- Room Handoff extras ---
  async resolveRoomHandoff(roomId: string, input?: { disposition?: string; note?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/handoff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input ?? {}),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Custom Domains ---
  async listCustomDomains(): Promise<Array<{ id: string; hostname: string; status: string; verifiedAt?: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/custom-domains`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.domains ?? [];
  }

  async createCustomDomain(input: { hostname: string }): Promise<{ id: string; hostname: string; status: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/custom-domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.domain ?? null;
  }

  async updateCustomDomain(id: string, patch: { hostname?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/custom-domains/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(patch),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async deleteCustomDomain(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/custom-domains/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Host Config ---
  async getPublicHostConfig(): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/host-config`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Embed Config ---
  async getEmbedConfig(): Promise<{ config: Record<string, unknown>; snippet: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/embed/config`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async updateEmbedConfig(input: Record<string, unknown>): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/embed/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async getPublicEmbedConfig(): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/embed/public-config`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Room Draft ---
  async getRoomDraft(roomId: string): Promise<{ content: string; updatedAt: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/draft`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async putRoomDraft(roomId: string, content: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ content }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Room Health ---
  async getRoomHealth(roomId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/health`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return {};
    return res.json();
  }

  // --- Terminate Room Connection ---
  async terminateRoomConnection(roomId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/terminate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Polls ---
  async createPoll(roomId: string, question: string, options: string[], opts?: { expiresAt?: string; multipleChoice?: boolean; anonymous?: boolean }): Promise<{ messageId: number; pollId: number } | null> {
    const { expiresAt, multipleChoice, anonymous } = opts ?? {};
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ roomId, question, options, expiresAt, multipleChoice, anonymous }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async votePoll(messageId: number, optionIndex: number): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/polls/${messageId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ optionIndex }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async getPoll(messageId: number): Promise<Record<string, unknown>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/polls/${messageId}`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return {};
    return res.json();
  }

  // --- Blocks ---
  async listBlocks(): Promise<Array<{ userId: string; blockedAt: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/blocks`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.blocks ?? [];
  }

  async blockUser(userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ userId }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async unblockUser(userId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/blocks/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Channel Authorization ---
  async authorizeChannel(channelName: string, { authEndpoint, authData, customAuthEndpoint, customAuthData }: { authEndpoint?: string; authData?: unknown; customAuthEndpoint?: string; customAuthData?: unknown }): Promise<{ authorized: boolean; socket_id?: string; channel_data?: unknown }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/channels/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ channelName, authEndpoint, authData, customAuthEndpoint, customAuthData }),
    });
    if (!res.ok) return { authorized: false };
    return res.json();
  }

  // --- Translation ---
  async translateMessage(messageId: number, targetLanguage: string): Promise<{ translated: string; language: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ targetLanguage }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  // --- Delivery Tracking ---
  async markMessageDelivered(messageId: number): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}/deliver`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async getMessageDeliveries(messageId: number): Promise<Array<{ userId: string; status: string; deliveredAt?: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/messages/${messageId}/deliveries`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.deliveries ?? [];
  }

  // --- Push Devices ---
  async registerPushDevice(input: { token: string; platform: string; userId?: string }): Promise<{ ok: boolean; deviceId: string }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/push-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, deviceId: '' };
    return res.json();
  }

  async unregisterPushDevice(deviceId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/push-devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async getVapidPublicKey(): Promise<string | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/web-push/vapid-public-key`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.publicKey ?? null;
  }

  async listWebPushSubscriptions(): Promise<Array<{ userId: string; endpoint: string; createdAt: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/web-push/subscriptions`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.subscriptions ?? [];
  }

  async listPushDevices(): Promise<Array<{ id: string; token: string; platform: string; createdAt: string }>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/push-devices`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.devices ?? [];
  }

  // --- Contact Sync ---
  async syncSentContact(contactId: string, { email, phone, name }: { email?: string; phone?: string; name?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/contacts/${encodeURIComponent(contactId)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ email, phone, name }),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  // --- Compliance ---
  async getRoomComplianceExport(roomId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/compliance-export`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return {};
    return res.json();
  }

  async exportRoomMarkdown(roomId: string): Promise<string> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/export/markdown`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return '';
    const body = await res.json();
    return body.markdown ?? '';
  }

  async exportRoomPdf(roomId: string): Promise<Blob | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/export/pdf`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.blob();
  }

  // --- Scheduled Messages ---
  async listScheduledMessages(roomId: string): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/scheduled-messages`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.scheduled ?? [];
  }

  async scheduleMessage(roomId: string, content: string, scheduledAt: string): Promise<{ id: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/scheduled-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ content, scheduledAt }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async cancelScheduledMessage(roomId: string, scheduleId: string): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/rooms/${encodeURIComponent(roomId)}/scheduled-messages/${encodeURIComponent(scheduleId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }

  // --- Agents ---
  async listAgents(): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.agents ?? [];
  }

  async invokeAgentRest(agentId: string, { roomId, message, context }: { roomId?: string; message: string; context?: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents/${encodeURIComponent(agentId)}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify({ roomId, message, context }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async getAgentRuns(agentId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents/${encodeURIComponent(agentId)}/runs?limit=${limit}`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.runs ?? [];
  }

  async getAgent(agentId: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents/${encodeURIComponent(agentId)}`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async createAgent(body: { name: string; systemPrompt: string; kind?: string; config?: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async updateAgent(agentId: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async deleteAgent(agentId: string): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }

  // --- Webhooks ---
  async registerWebhook(body: { url: string; eventTypes?: string[]; secret?: string }): Promise<{ id: string } | null> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async updateWebhook(webhookId: string, body: { url?: string; eventTypes?: string[]; secret?: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/webhooks/${encodeURIComponent(webhookId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
      body: JSON.stringify(body),
    });
    return res.ok ? { ok: true } : { ok: false };
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await fetch(`${trimTrailingSlashes(this.config.apiUrl)}/webhooks/${encodeURIComponent(webhookId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
  }
}
