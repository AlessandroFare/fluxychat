import { ChatEvent, EventHandler, FluxyChatConfig } from './types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export class WebSocketClient {
  private wsUrl: string;
  private projectId: string;
  private token: string;
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private debug: boolean;

  constructor(config: FluxyChatConfig) {
    this.wsUrl = config.wsUrl.replace(/\/$/, '');
    this.projectId = config.projectId;
    this.token = config.token;
    this.debug = config.debug || false;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(roomId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    this.setStatus('connecting');
    const url = `${this.wsUrl}/ws?roomId=${roomId}&token=${this.token}&projectId=${this.projectId}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.log('WebSocket connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          this.log('Failed to parse message', e);
        }
      };

      this.ws.onclose = (event) => {
        this.log('WebSocket closed', event.code, event.reason);
        this.stopPing();
        if (event.code !== 1000) {
          this.attemptReconnect(roomId);
        } else {
          this.setStatus('disconnected');
        }
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket error', error);
        this.ws?.close();
      };
    } catch (e) {
      this.log('Failed to create WebSocket', e);
      this.attemptReconnect(roomId);
    }
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this.setStatus('disconnected');
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.log('Cannot send, WebSocket not connected');
    }
  }

  sendTyping(roomId: string, typing: boolean): void {
    this.send({ type: 'typing', roomId, typing });
  }

  sendPresence(roomId: string, status: string): void {
    this.send({ type: 'presence', roomId, status });
  }

  sendReadReceipt(roomId: string, messageId: string): void {
    this.send({ type: 'read', roomId, messageId });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private handleMessage(data: ChatEvent): void {
    const handlers = this.eventHandlers.get(data.type);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(data));
    }
  }

  private attemptReconnect(roomId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(roomId);
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[FluxyChat WS]', ...args);
    }
  }
}
