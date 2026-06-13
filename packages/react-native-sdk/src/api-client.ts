import { FluxyChatConfig, Message, Room, User, PaginationOptions } from './types';

export class ApiClient {
  private baseUrl: string;
  private projectId: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(config: FluxyChatConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.projectId = config.projectId;
    this.token = config.token;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'X-Project-Id': this.projectId,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Rooms
  async listRooms(options?: PaginationOptions): Promise<Room[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    return this.request<Room[]>('GET', `/api/rooms?${params.toString()}`);
  }

  async getRoom(roomId: string): Promise<Room> {
    return this.request<Room>('GET', `/api/rooms/${roomId}`);
  }

  async createRoom(name: string, type: Room['type'] = 'group'): Promise<Room> {
    return this.request<Room>('POST', '/api/rooms', { name, type });
  }

  async updateRoom(roomId: string, data: Partial<Room>): Promise<Room> {
    return this.request<Room>('PATCH', `/api/rooms/${roomId}`, data);
  }

  async deleteRoom(roomId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/rooms/${roomId}`);
  }

  // Members
  async addMember(roomId: string, userId: string): Promise<void> {
    return this.request<void>('POST', `/api/rooms/${roomId}/members`, { userId });
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/rooms/${roomId}/members`, { userId });
  }

  async listMembers(roomId: string): Promise<User[]> {
    return this.request<User[]>('GET', `/api/rooms/${roomId}/members`);
  }

  // Messages
  async listMessages(roomId: string, options?: PaginationOptions): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    if (options?.after) params.set('after', options.after);
    return this.request<Message[]>('GET', `/api/rooms/${roomId}/messages?${params.toString()}`);
  }

  async sendMessage(roomId: string, content: string, kind: Message['kind'] = 'text', metadata?: Record<string, unknown>): Promise<Message> {
    return this.request<Message>('POST', `/api/rooms/${roomId}/messages`, { content, kind, metadata });
  }

  async editMessage(roomId: string, messageId: string, content: string): Promise<Message> {
    return this.request<Message>('PATCH', `/api/rooms/${roomId}/messages/${messageId}`, { content });
  }

  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/rooms/${roomId}/messages/${messageId}`);
  }

  // Reactions
  async addReaction(roomId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>('POST', `/api/rooms/${roomId}/messages/${messageId}/reactions`, { emoji });
  }

  async removeReaction(roomId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>('DELETE', `/api/rooms/${roomId}/messages/${messageId}/reactions`, { emoji });
  }

  // Presence
  async getPresence(roomId: string): Promise<{ online: User[]; total: number }> {
    return this.request('GET', `/api/rooms/${roomId}/presence`);
  }

  // AI
  async invokeAgent(roomId: string, agentId: string, message: string): Promise<Message> {
    return this.request<Message>('POST', `/api/rooms/${roomId}/ai/invoke`, { agentId, message });
  }

  // Search
  async searchMessages(query: string, roomId?: string): Promise<Message[]> {
    const params = new URLSearchParams({ q: query });
    if (roomId) params.set('roomId', roomId);
    return this.request<Message[]>('GET', `/api/search?${params.toString()}`);
  }

  // Export
  async exportRoom(roomId: string, format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const params = new URLSearchParams({ format });
    const url = `${this.baseUrl}/api/rooms/${roomId}/export?${params.toString()}`;
    const response = await fetch(url, { headers: this.headers });
    return response.blob();
  }
}
