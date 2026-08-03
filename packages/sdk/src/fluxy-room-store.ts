import { createStore, type StoreApi } from "zustand/vanilla";
import { buildFluxyConnectionState, type FluxyConnectionState, type FluxyConnectionStateStatus } from "./connection-state";
import type { FluxyChatTransport } from "./connection-state";
import type { FluxyRoomConnectionStatus as FluxyWsConnectionStatus } from "./room-connection";
import type { FluxySendMessageOptions } from "./message-template";
import type {
  FluxyChatAgentRun,
  FluxyChatAttachment,
  FluxyChatMessage,
  FluxyRoomLive,
} from "./index";

/** WebSocket status plus Portal-style degraded / blocked and legacy SSE/polling aliases. */
export type FluxyUseChatConnectionStatus = FluxyConnectionStateStatus;

export interface FluxyToolThreadEvent {
  key: string;
  kind: "tool_call" | "tool_result" | "tool_error";
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
  typingIntents: Record<string, import("./index").FluxyPresenceIntent>;
  seenBy: Record<number, string[]>;
  onlineUsers: string[];
  presenceMembers: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
  /** REST snapshot from `GET /rooms/:id/live` (Portal-style getParticipants). */
  liveSnapshot: FluxyRoomLive | null;
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
  debateSteps: import("./agent-debate").AgentDebateStep[];
  debateSessionId: string | null;
  voiceStage: import("./voice-stage").VoiceStageSnapshot | null;
  sendMessage: (
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
    options?: FluxySendMessageOptions,
  ) => void;
  retryMessage: (clientMessageId: string) => void;
  loadHistory: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Refresh `liveSnapshot` from `GET /rooms/:id/live` (Portal-style). */
  loadLive: () => Promise<void>;
  setTyping: (isTyping: boolean, intent?: import("./message-template").FluxyPresenceIntent, partialText?: string) => void;
  editMessage: (messageId: number, content: string) => void;
  sendReaction: (messageId: number, emoji: string, op?: "add" | "remove") => void;
  sendReadReceipt: (messageId: number) => void;
  deleteMessage: (messageId: number) => void;
  branchRoomFromMessage: (fromMessageId: number) => Promise<void>;
  invokeAgent: (
    content: string,
    options?: { agentId?: string; replyTo?: number | null },
  ) => Promise<unknown>;
  clearToolThread: () => void;
  clearDebateThread: () => void;
  joinVoiceStage: (role: import("./voice-stage").VoiceStageRole, displayName?: string) => void;
  leaveVoiceStage: () => void;
  promoteVoiceStageListener: (targetUserId: string) => void;
  sendVoiceStageVad: (score: number) => void;
  sendClientEvent: (eventName: string, data: unknown) => void;
}

export type FluxyRoomStore = StoreApi<FluxyRoomStoreState>;

function noop(): void {
  /* bound when session starts */
}

function notReady(): never {
  throw new Error("Fluxy room session is not started");
}

const inertRoomActions: Pick<
  FluxyRoomStoreState,
  | "sendMessage"
  | "retryMessage"
  | "loadHistory"
  | "loadMore"
  | "loadLive"
  | "setTyping"
  | "editMessage"
  | "sendReaction"
  | "sendReadReceipt"
  | "deleteMessage"
  | "branchRoomFromMessage"
  | "invokeAgent"
  | "clearToolThread"
  | "clearDebateThread"
  | "joinVoiceStage"
  | "leaveVoiceStage"
  | "promoteVoiceStageListener"
  | "sendVoiceStageVad"
  | "sendClientEvent"
> = Object.freeze({
  sendMessage: noop,
  retryMessage: noop,
  loadHistory: async () => {},
  loadMore: async () => {},
  loadLive: async () => {},
  setTyping: noop,
  editMessage: noop,
  sendReaction: noop,
  sendReadReceipt: noop,
  deleteMessage: noop,
  branchRoomFromMessage: async () => notReady(),
  invokeAgent: async () => notReady(),
  clearToolThread: noop,
  clearDebateThread: noop,
  joinVoiceStage: noop,
  leaveVoiceStage: noop,
  promoteVoiceStageListener: noop,
  sendVoiceStageVad: noop,
  sendClientEvent: noop,
});

/**
 * Frozen snapshot for SSR and pre-session render (Portal-style inert identity).
 * Referentially stable — safe as `useSyncExternalStore` server snapshot.
 */
export const INERT_FLUXY_ROOM_SNAPSHOT: FluxyRoomStoreState = Object.freeze({
  messages: [] as FluxyChatMessage[],
  hasMore: false,
  isLoadingMore: false,
  historyLoaded: false,
  online: 0,
  typingUsers: {} as Record<string, boolean>,
  typingIntents: {} as Record<string, import("./index").FluxyPresenceIntent>,
  seenBy: {} as Record<number, string[]>,
  onlineUsers: [] as string[],
  presenceMembers: [] as Array<{ userId: string; userInfo?: Record<string, unknown> }>,
  liveSnapshot: null,
  subscriptionCount: 0,
  socketId: null,
  connected: false,
  connectionStatus: "idle" as FluxyUseChatConnectionStatus,
  connectionState: buildFluxyConnectionState({ status: "idle", transport: "none" }),
  reconnectAttempt: 0,
  reconnectDelayMs: 0,
  connectionError: null,
  agentTyping: false,
  wsTypingAgentId: null,
  invokeTypingAgentId: null,
  reactions: {} as Record<number, Record<string, number>>,
  toolThreadEvents: [] as FluxyToolThreadEvent[],
  lastAgentRun: null,
  debateSteps: [],
  debateSessionId: null,
  voiceStage: null,
  ...inertRoomActions,
});

export function createFluxyRoomStore(): FluxyRoomStore {
  return createStore<FluxyRoomStoreState>()(() => ({
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
    liveSnapshot: null,
    subscriptionCount: 0,
    socketId: null,
    connected: false,
    connectionStatus: "connecting",
    connectionState: buildFluxyConnectionState({ status: "connecting" }),
    reconnectAttempt: 0,
    reconnectDelayMs: 0,
    connectionError: null,
    agentTyping: false,
    wsTypingAgentId: null,
    invokeTypingAgentId: null,
    reactions: {},
    toolThreadEvents: [],
    lastAgentRun: null,
    debateSteps: [],
    debateSessionId: null,
    voiceStage: null,
    ...inertRoomActions,
  }));
}

export function syncRoomConnectionState(
  patch: Partial<
    Pick<
      FluxyRoomStoreState,
      | "connectionStatus"
      | "connectionError"
      | "reconnectAttempt"
      | "reconnectDelayMs"
      | "connected"
    >
  > & { fallbackTransport?: FluxyChatTransport; canPublishViaHttp?: boolean },
  current: Pick<
    FluxyRoomStoreState,
    | "connectionStatus"
    | "connectionError"
    | "reconnectAttempt"
    | "reconnectDelayMs"
    | "connected"
  >,
): Pick<
  FluxyRoomStoreState,
  | "connectionStatus"
  | "connectionError"
  | "reconnectAttempt"
  | "reconnectDelayMs"
  | "connected"
  | "connectionState"
> {
  const connectionStatus = patch.connectionStatus ?? current.connectionStatus;
  const connectionError =
    patch.connectionError !== undefined ? patch.connectionError : current.connectionError;
  const reconnectAttempt = patch.reconnectAttempt ?? current.reconnectAttempt;
  const reconnectDelayMs = patch.reconnectDelayMs ?? current.reconnectDelayMs;
  const connected = patch.connected ?? current.connected;
  const { fallbackTransport, canPublishViaHttp } = patch;

  return {
    connectionStatus,
    connectionError,
    reconnectAttempt,
    reconnectDelayMs,
    connected,
    connectionState: buildFluxyConnectionState({
      status: connectionStatus,
      lastError: connectionError,
      retryAttempt: reconnectAttempt,
      reconnectDelayMs:
        connectionStatus === "reconnecting" ? reconnectDelayMs : null,
      transport: fallbackTransport,
      canPublishViaHttp: canPublishViaHttp ?? false,
    }),
  };
}
