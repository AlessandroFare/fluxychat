import { FluxyChatMessage, FluxyChatAgentRun, FluxyChatAttachment } from './index';
import { buildFluxyConnectionState, FluxyConnectionState, FluxyConnectionStateStatus } from './connection-state';
import { FluxyRoomConnectionStatus } from './room-connection';
import { sortMessagesChronological } from './message-history';

export type FluxyUseChatConnectionStatus = FluxyRoomConnectionStatus | 'polling' | 'sse';

export interface FluxyToolThreadEvent {
  key: string;
  kind: 'tool_call' | 'tool_result' | 'tool_error';
  runId: string;
  toolCallId: string;
  name: string;
  arguments?: string;
  resultPreview?: string | null;
  error?: string | null;
}

export interface FluxyRoomStoreState {
  messages: FluxyChatMessage[];
  hasMore: boolean;
  isLoadingMore: boolean;
  historyLoaded: boolean;
  online: number;
  typingUsers: Record<string, boolean>;
  typingIntents: Record<string, string>;
  seenBy: Record<number, string[]>;
  onlineUsers: string[];
  presenceMembers: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
  subscriptionCount: number;
  socketId: string | null;
  connected: boolean;
  connectionStatus: FluxyUseChatConnectionStatus;
  connectionState: FluxyConnectionState;
  reconnectAttempt: number;
  reconnectDelayMs: number;
  connectionError: Error | null;
  agentTyping: boolean;
  wsTypingAgentId: string | null;
  invokeTypingAgentId: string | null;
  reactions: Record<number, Record<string, number>>;
  toolThreadEvents: FluxyToolThreadEvent[];
  lastAgentRun: FluxyChatAgentRun | null;
  sendMessage: (content: string, replyTo?: number | null, attachments?: FluxyChatAttachment[]) => void;
  retryMessage: (clientMessageId: string) => void;
  loadHistory: () => Promise<void>;
  loadMore: () => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  editMessage: (messageId: number, content: string) => void;
  sendReaction: (messageId: number, emoji: string, op?: 'add' | 'remove') => void;
  sendReadReceipt: (messageId: number) => void;
  deleteMessage: (messageId: number) => void;
  invokeAgent: (content: string, options?: { agentId?: string; replyTo?: number | null }) => Promise<unknown>;
  clearToolThread: () => void;
}

export interface FluxyRoomStore {
  getState: () => FluxyRoomStoreState;
  setState: (patch: Partial<FluxyRoomStoreState> | ((state: FluxyRoomStoreState) => Partial<FluxyRoomStoreState>)) => void;
  subscribe: (listener: (state: FluxyRoomStoreState) => void) => () => void;
}

function noop(): void {}
function notReady(): never { throw new Error('Room session not started'); }

export function createFluxyRoomStore(): FluxyRoomStore {
  let state: FluxyRoomStoreState = {
    messages: [],
    hasMore: false,
    isLoadingMore: false,
    historyLoaded: false,
    online: 0,
    typingUsers: {},
    typingIntents: {},
    seenBy: {},
    onlineUsers: [],
    presenceMembers: [],
    subscriptionCount: 0,
    socketId: null,
    connected: false,
    connectionStatus: 'connecting',
    connectionState: buildFluxyConnectionState({ status: 'connecting' }),
    reconnectAttempt: 0,
    reconnectDelayMs: 0,
    connectionError: null,
    agentTyping: false,
    wsTypingAgentId: null,
    invokeTypingAgentId: null,
    reactions: {},
    toolThreadEvents: [],
    lastAgentRun: null,
    sendMessage: noop,
    retryMessage: noop,
    loadHistory: async () => {},
    loadMore: async () => {},
    setTyping: noop,
    editMessage: noop,
    sendReaction: noop,
    sendReadReceipt: noop,
    deleteMessage: noop,
    invokeAgent: async () => notReady(),
    clearToolThread: noop,
  };
  const listeners = new Set<(state: FluxyRoomStoreState) => void>();

  return {
    getState: () => state,
    setState: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next } as FluxyRoomStoreState;
      for (const listener of listeners) { try { listener(state); } catch {} }
    },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export function syncRoomConnectionState(
  patch: Partial<Pick<FluxyRoomStoreState, 'connectionStatus' | 'connectionError' | 'reconnectAttempt' | 'reconnectDelayMs' | 'connected'>>,
  current: Pick<FluxyRoomStoreState, 'connectionStatus' | 'connectionError' | 'reconnectAttempt' | 'reconnectDelayMs' | 'connected'>,
): Pick<FluxyRoomStoreState, 'connectionStatus' | 'connectionError' | 'reconnectAttempt' | 'reconnectDelayMs' | 'connected' | 'connectionState'> {
  const connectionStatus = patch.connectionStatus ?? current.connectionStatus;
  const connectionError = patch.connectionError !== undefined ? patch.connectionError : current.connectionError;
  const reconnectAttempt = patch.reconnectAttempt ?? current.reconnectAttempt;
  const reconnectDelayMs = patch.reconnectDelayMs ?? current.reconnectDelayMs;
  const connected = patch.connected ?? current.connected;
  return {
    connectionStatus, connectionError, reconnectAttempt, reconnectDelayMs, connected,
    connectionState: buildFluxyConnectionState({ status: connectionStatus, lastError: connectionError, retryAttempt: reconnectAttempt, reconnectDelayMs: connectionStatus === 'reconnecting' ? reconnectDelayMs : null }),
  };
}
