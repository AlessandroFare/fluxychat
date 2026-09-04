import { FluxyChatRoomConnection, type FluxyRoomConnectionOptions } from "./room-connection";
import { FluxyAuthError, FluxySendError } from "./errors";
import { clampHistoryLimit, sortMessagesChronological } from "./message-history";
import { normalizeRoomMembers } from "./room-rest";
import { trimTrailingSlashes } from "./url-utils";
import { FluxyClientCredentials, type FluxyTokenSource } from "./client-credentials";
import { applyInboxQuery, type FluxyInboxQuery } from "./inbox-filter";
import { createFluxyWebSocket } from "./websocket-factory";
import { decodeFluxyJwtPayload } from "./jwt-utils";
import type {
  FluxyComment,
  FluxyCommentThread,
  FluxyCommentThreadMetadata,
} from "./comment-threads";
import type { FluxyFeed, FluxyFeedMessage, FluxyFeedMessageMetadata } from "./room-feeds";

export interface FluxyChatMessage {
  id: number;
  roomId: string;
  userId: string;
  senderId?: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mentions?: string[];
  preview?: {
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    aiSummary?: string | null;
  };
  attachments?: FluxyChatAttachment[];
  /** True while an agent (or user) is still streaming tokens into this message. */
  streaming?: boolean;
  /** Client-only id for optimistic send dedupe (not stored server-side yet). */
  clientMessageId?: string;
  /** Client-only delivery state for optimistic UI. */
  deliveryStatus?: "pending" | "sent" | "failed";
  deliveryError?: string;
  /** Server ack content differed from optimistic draft (CRDT/offline conflict). */
  deliveryConflict?: boolean;
  /** ISO timestamp when the message self-deletes (ephemeral / TTL). */
  expiresAt?: string | null;
  visibility?: import("./message-template").FluxyMessageVisibility;
  visibleTo?: string[];
  /**
   * Reaction tallies keyed by emoji (e.g. `{ "ðŸ‘": 2 }`). Client-side for now;
   * the Worker does not persist these yet, so the map is assembled by the UI
   * from local interactions. Optional â€” absent means "no reactions".
   */
  reactions?: Record<string, number>;
  poll?: {
    messageId: number;
    question: string;
    allowMultiple: boolean;
    options: Array<{ index: number; text: string; votes: number }>;
    totalVoters: number;
    closed: boolean;
    userVote?: number | null;
  };
  decision?: {
    messageId: number;
    content: string;
    state: "pending" | "decided" | "expired_no_quorum";
    progress: Array<{
      role: string;
      required: number;
      current: number;
      ackedBy: Array<{ userId: string; ackedAt: string }>;
    }>;
    totalRequired: number;
    totalCurrent: number;
    quorumMet: boolean;
    expiresAt: string;
    acks: Array<{ userId: string; role: string; ackedAt: string }>;
  };
  /** Message kind. `text` is the default and is implicit; `voice` is set
   *  by `POST /messages/voice` and carries audio metadata + a possibly
   *  pending transcription. */
  kind?: "text" | "voice";
  /** Public URL (or R2 key path) of the recorded audio. Present when
   *  `kind === "voice"`. */
  audioUrl?: string | null;
  /** MIME type of the recorded audio (e.g. `audio/webm`). */
  audioMimeType?: string | null;
  /** Size in bytes of the recorded audio. */
  audioSizeBytes?: number | null;
  /** Client-measured recording duration in milliseconds. */
  durationMs?: number | null;
  /** Transcript of the audio. Populated asynchronously by the Worker
   *  after the upload; `null` while `transcriptionStatus === "pending"`. */
  transcription?: string | null;
  /** Status of the async transcription job.
   *  - `pending`  : the Worker has the audio, transcription is in flight
   *  - `done`     : `transcription` is populated
   *  - `failed`   : transcription could not be produced (UI may show a
   *                 "transcript unavailable" placeholder) */
  transcriptionStatus?: "pending" | "done" | "failed" | null;
  /** Rich interactive card payload (inline or parsed from content). */
  card?: import("./cards").CardElement;
}

export interface FluxyChatAttachment {
  id?: number;
  /** Attachment category. The known kinds drive rendering (`image`, `file`,
   *  `audio`, `location`); the `string & {}` tail keeps the type open so
   *  callers can pass custom kinds without a cast. */
  kind: "image" | "file" | "audio" | "location" | (string & {});
  url: string;
  name: string;
  sizeBytes?: number;
  contentType?: string;
}

const AUDIO_FILE_SUFFIXES = [".webm", ".m4a", ".mp3", ".wav", ".ogg"];

function fileNameLooksLikeAudio(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of AUDIO_FILE_SUFFIXES) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function inferAttachmentKind(contentType: string, fileName: string): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (fileNameLooksLikeAudio(fileName)) return "audio";
  return "file";
}

function httpUrlToWebSocketBase(url: string): string {
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

export interface FluxyChatRoom {
  id: string;
  type: "dm" | "group" | "public";
  name: string;
  created_at: string;
  unreadCount?: number;
}

/** Catch-up metadata from `GET /rooms/:id/unread` (jump-to-first-unread UX). */
export interface FluxyRoomCatchUp {
  unreadCount: number;
  lastReadMessageId: number;
  firstUnreadMessageId: number | null;
  digest?: string | null;
  highlights?: Array<{ index?: number; text?: string; messageId?: number; userId?: string; preview?: string }>;
  messageSampleCount?: number;
}

/** Reaction mood timeline from `GET /rooms/:id/sentiment`. */
export interface FluxyRoomSentiment {
  roomId: string;
  days: number;
  aggregate: {
    mood: "positive" | "negative" | "neutral";
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  };
  timeline: Array<{
    day: string;
    mood: "positive" | "negative" | "neutral";
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    reactions: Record<string, number>;
  }>;
}

/** Room-scoped compose draft synced via member preferences. */
export interface FluxyRoomMessageDraft {
  content: string;
  replyToId: number | null;
  updatedAt: string;
}

export interface FluxyInAppNotification {
  id: number;
  kind: string;
  title: string;
  body?: string | null;
  room_id?: string | null;
  message_id?: number | null;
  read_at?: string | null;
  created_at: string;
}

export interface FluxyInboxMention {
  messageId: number;
  roomId: string;
  roomName: string;
  roomType?: string;
  authorId: string;
  preview: string;
  createdAt: string;
  isUnread: boolean;
}

export interface FluxyInboxRoomEntry {
  roomId: string;
  roomName: string;
  roomType?: string;
  unreadCount: number;
  lastReadMessageId: number;
  firstUnreadMessageId: number | null;
  snoozedUntil?: string | null;
  lastMessage?: {
    messageId: number;
    userId: string;
    preview: string;
    createdAt: string;
  } | null;
}

export interface FluxyInboxFollowUp {
  id: string;
  roomId: string;
  roomName: string;
  messageId?: number | null;
  note?: string | null;
  dueAt?: string | null;
  status: string;
  createdAt: string;
}

export interface FluxyInboxSummary {
  mentions: FluxyInboxMention[];
  unreadRooms: FluxyInboxRoomEntry[];
  snoozedRooms: FluxyInboxRoomEntry[];
  followUps: FluxyInboxFollowUp[];
  counts: {
    mentions: number;
    unreadRooms: number;
    snoozedRooms: number;
    followUps: number;
  };
}

export interface FluxyAgentTask {
  id: string;
  roomId: string;
  roomName: string;
  roomType?: string | null;
  status: "open" | "claimed" | "resolved" | "cancelled" | string;
  priority: number;
  assigneeUserId?: string | null;
  claimedAt?: string | null;
  slaDueAt: string;
  slaBreached: boolean;
  secondsToSla?: number | null;
  resolvedAt?: string | null;
  disposition?: string | null;
  note?: string | null;
  triggerSource: string;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyAgentQueueSummary {
  tasks: FluxyAgentTask[];
  counts: {
    total: number;
    open: number;
    claimed: number;
    slaBreached: number;
  };
  slaMinutes: number;
}

export interface FluxyAgentDisposition {
  code: string;
  label: string;
}

export interface FluxyCustomDomain {
  id: string;
  projectId: string;
  hostname: string;
  defaultRoomId?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  allowedOrigins?: string[];
  status: "pending" | "active" | "disabled" | string;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyPublicHostConfig {
  configured: boolean;
  projectId?: string;
  hostname?: string;
  defaultRoomId?: string | null;
  brand?: { name?: string | null; logoUrl?: string | null };
}

export interface FluxyClientFeatureFlags {
  flags: {
    voice_messages: boolean;
    reply_suggestions: boolean;
    embed_widget: boolean;
    reconnect_backoff_fluxy: boolean;
  };
  flagship: boolean;
  reconnectBackoff: { baseBackoffMs: number; maxBackoffMs: number };
}

export interface FluxyEmbedTheme {
  primaryColor: string;
  position: "bottom-right" | "bottom-left" | string;
}

export interface FluxyEmbedProactiveTrigger {
  id?: string;
  enabled?: boolean;
  urlPattern?: string;
  dwellSeconds?: number;
  message?: string;
  autoOpen?: boolean;
}

export interface FluxyEmbedConfig {
  projectId: string;
  enabled: boolean;
  defaultRoomId?: string | null;
  allowedOrigins: string[];
  zIndex: number;
  launcherTitle: string;
  theme: FluxyEmbedTheme;
  proactiveTriggers?: FluxyEmbedProactiveTrigger[];
  createdAt: string;
  updatedAt: string;
}

export interface FluxyQuietHoursPreferences {
  enabled: boolean;
  timezone: string;
  quietStart: string;
  quietEnd: string;
  batchPush: boolean;
  batchInApp: boolean;
  updatedAt: string | null;
}

export interface FluxyPublicEmbedConfig {
  enabled: boolean;
  reason?: string;
  projectId?: string;
  defaultRoomId?: string | null;
  zIndex?: number;
  launcherTitle?: string;
  theme?: FluxyEmbedTheme;
  proactiveTriggers?: FluxyEmbedProactiveTrigger[];
  readOnly?: boolean;
  scriptUrl?: string;
  framePath?: string;
}

export interface FluxyRoomHandoffState {
  status: string;
  active: boolean;
  handoffId?: string | null;
  agentId?: string | null;
  agentTaskId?: string | null;
  handedOffByUserId?: string | null;
  handedOffAt?: string | null;
  contextSummary?: string | null;
  disposition?: string | null;
  resolvedAt?: string | null;
}

export interface FluxyRoomMember {
  userId: string;
  role: string;
  joined_at?: string;
  joinedAt?: string;
  notifyEnabled?: boolean;
  preferences?: Record<string, unknown>;
}

export interface FetchMessagesOptions {
  limit?: number;
  /** ISO `createdAt` cursor  returns messages older than this timestamp. */
  before?: string;
}

export interface FluxyChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface FluxyChatAgent {
  id: string;
  projectId: string;
  name: string;
  handle?: string | null;
  provider?: string | null;
  model?: string | null;
  capabilities?: string[];
  config?: Record<string, unknown> | null;
  systemPrompt?: string | null;
  contextFetchUrl?: string | null;
  toolExecuteUrl?: string | null;
  toolsSchema?: FluxyChatToolDefinition[] | null;
  rateLimitRpm?: number | null;
  createdAt?: string;
}

export interface FluxyChatToolCall {
  id: string;
  name: string;
  arguments: string;
  success?: boolean;
  result?: unknown;
  error?: string;
}

export interface FluxyChatAgentRun {
  id: string;
  status: "queued" | "completed" | "failed";
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error?: string | null;
  room_id?: string | null;
  tool_calls?: FluxyChatToolCall[];
  context_fetched?: boolean;
  iterations?: number;
  created_at: string;
}
/** Query params for `FluxyChatClient.connect()`. */
export interface FluxyWebSocketConnectOptions {
  /** Skip server history snapshot on connect (default: send snapshot). */
  replay?: "connect" | "off";
  /** Cap for WS history/replay snapshot (default server: 50, max 500). */
  replayLimit?: number;
  /** Optional presence profile sent on WS connect (`presenceInfo` query param). */
  presenceInfo?: Record<string, unknown>;
  /** Request Pusher-style cache snapshot on connect (`cache=1` query param). */
  cache?: "on" | "off";
  /**
   * Spectator socket: receive room events, cannot publish.
   * Query `readonly=1`. JWT roles `spectator` / `viewer` / `readonly` also force this.
   */
  readonly?: boolean;
}

/** Single member in a `FluxyRoomLive.members` snapshot. */
export interface FluxyRoomLiveMember {
  userId: string;
  userInfo?: Record<string, unknown>;
}

/** REST snapshot of a room's live presence (Pusher-style channel stats + members). */
export interface FluxyRoomLive {
  roomId: string;
  shardCount: number;
  occupied: boolean;
  subscriptionCount: number;
  userCount: number;
  online: number;
  users: string[];
  members: FluxyRoomLiveMember[];
  socketIds: string[];
}

export type FluxyChatEvent =
  | { type: "history"; messages: FluxyChatMessage[]; reactions?: Record<number, Record<string, number>> }
  | { type: "replay"; messages: FluxyChatMessage[]; reactions?: Record<number, Record<string, number>> }
  | {
      type: "streamState";
      messageId: number;
      roomId: string;
      userId: string;
      content: string;
      createdAt: string;
      parentId?: number | null;
      streaming: boolean;
    }
  | ({ type: "message" } & FluxyChatMessage)
  | {
      /** Patch event for a previously broadcast message. Used for
       *  asynchronous enrichments (e.g. voice message transcription
       *  arriving after the upload has already been announced). The
       *  client should merge the fields into the existing message in
       *  its store, keyed by `id` + `roomId`. */
      type: "message_updated";
      id: number;
      roomId: string;
      kind?: "text" | "voice";
      transcription?: string | null;
      transcriptionStatus?: "pending" | "done" | "failed" | null;
      transcriptionModel?: string;
    }
  | {
      type: "poll_updated";
      roomId: string;
      messageId: number;
      poll: NonNullable<FluxyChatMessage["poll"]>;
    }
  | {
      type: "decision_updated";
      roomId: string;
      messageId: number;
      userId?: string;
      decision: {
        messageId: number;
        content: string;
        state: "pending" | "decided" | "expired_no_quorum";
        progress: Array<{
          role: string;
          required: number;
          current: number;
          ackedBy: Array<{ userId: string; ackedAt: string }>;
        }>;
        totalRequired: number;
        totalCurrent: number;
        quorumMet: boolean;
        expiresAt: string;
        acks: Array<{ userId: string; role: string; ackedAt: string }>;
      };
    }
  | {
      type: "edit";
      id: number;
      roomId: string;
      userId: string;
      content: string;
      editedAt: string;
      streaming?: boolean;
    }
  | {
      type: "stream";
      op: "started";
      id: number;
      roomId: string;
    }
  | {
      type: "reaction";
      roomId: string;
      userId: string;
      messageId: number;
      emoji: string;
      op: "add" | "remove";
    }
  | {
      type: "read";
      roomId: string;
      userId: string;
      messageId: number;
      createdAt: string;
    }
  | {
      type: "delete";
      id: number;
      roomId: string;
      userId: string;
      deletedAt: string;
      hard?: boolean;
    }
  | {
      type: "message_expired";
      id: number;
      roomId: string;
      userId: string;
      expiredAt: string;
      deletedAt?: string;
    }
  | {
      type: "typing";
      userId: string;
      isTyping: boolean;
      intent?: import("./message-template").FluxyPresenceIntent;
    }
  | {
      type: "cursor";
      userId: string;
      roomId?: string;
      x: number;
      y: number;
      pointer?: "mouse" | "touch";
      color?: string;
      label?: string;
      ts?: number;
    }
  | {
      type: "presence_patch";
      userId: string;
      roomId?: string;
      data: import("./presence-patch").FluxyPresence;
      ts?: number;
    }
  | {
      type: "subscription_succeeded";
      roomId: string;
      socketId?: string;
      subscriptionCount: number;
      kind?: "detailed" | "aggregate";
      count?: number;
      members: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
      derived?: Record<string, unknown>;
      derivedSeq?: number;
    }
  | {
      type: "derived";
      roomId?: string;
      userId?: string;
      state: Record<string, unknown>;
      seq?: number;
    }
  | {
      type: "subscription_count";
      roomId: string;
      subscriptionCount: number;
    }
  | {
      type: "member_joined";
      roomId: string;
      userId: string;
      userInfo?: Record<string, unknown>;
    }
  | { type: "member_left"; roomId: string; userId: string }
  | {
      type: "client_event";
      roomId: string;
      userId: string;
      eventName: string;
      data: unknown;
    }
  | import("@fluxy-chat/protocol").LocationUpdateInbound
  | import("@fluxy-chat/protocol").LocationSnapshotInbound
  | import("@fluxy-chat/protocol").LocationTrackEndedInbound
  | { type: "agentTyping"; agentId: string; isTyping: boolean }
  | {
      type: "tool_call";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      arguments?: string;
      parentRunId?: string | null;
      parentToolCallId?: string | null;
      nestDepth?: number;
    }
  | {
      type: "tool_result";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      result?: unknown;
      parentRunId?: string | null;
      parentToolCallId?: string | null;
      nestDepth?: number;
    }
  | {
      type: "tool_error";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      error?: string;
      parentRunId?: string | null;
      parentToolCallId?: string | null;
      nestDepth?: number;
    }
  | {
      type: "approval_request";
      approvalId: string;
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      input: Record<string, unknown>;
      reason?: string;
      expiresAt?: string;
    }
  | {
      type: "approval_decision";
      approvalId: string;
      runId: string;
      toolCallId: string;
      status: "approved" | "denied" | "expired" | "cancelled";
      decidedBy?: string;
      note?: string;
    }
  | { type: "agentRun"; run: FluxyChatAgentRun }
  | {
      type: "agent_step";
      roomId: string;
      sessionId?: string;
      step: import("./agent-debate").AgentDebateStep;
    }
  | {
      type: "stage_updated";
      roomId: string;
      stage: import("./voice-stage").VoiceStageSnapshot;
    }
  | { type: "active_speaker"; roomId: string; userId: string | null }
  | {
      type: "presence";
      online: number;
      kind?: "detailed" | "aggregate";
      count?: number;
      users?: string[];
      members?: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
    }
  | {
      type: "cache_snapshot";
      roomId: string;
      event: Record<string, unknown>;
      cachedAt: string;
    }
  | {
      type: "server_event";
      roomId: string;
      name: string;
      data: unknown;
      userId?: string;
    }
  | {
      type: "user_event";
      userId: string;
      name: string;
      data: unknown;
      at?: string;
      roomId?: string;
    }
  | {
      type: "user_subscription_succeeded";
      userId: string;
      socketId?: string;
      connectionCount: number;
    }
  | {
      type: "state_change";
      roomId: string;
      previous: import("./room-connection").FluxyRoomConnectionStatus;
      current: import("./room-connection").FluxyRoomConnectionStatus;
    }
  | { type: "error"; message: string };

export interface FluxySignInResponse {
  token: string;
  expiresIn: number;
  claims: { sub: string; tid: string; roles: string[] };
  signin: true;
  userId: string;
  projectId: string;
  userChannel: {
    websocketPath: string;
    inboxWebsocketPath?: string;
    eventsPath: string;
  };
}

export interface FluxyChatClientOptions {
  baseUrl: string;
  userId: string;
  apiKey?: string;
  /**
   * Browser-safe project key (`pk_…`). Same header as apiKey. Cannot mint member JWTs
   * (`POST /auth/token` / `signIn`). Use for guest-session and anonymous tokens.
   */
  publishableKey?: string;
  /**
   * Optional JWT for authenticated REST calls (POST /messages, reactions, read, reports, etc).
   * When provided, the SDK will prefer REST for writes and use WebSocket mainly for realtime updates.
   * Omit with `apiKey` to enable anonymous auto-mint via POST /tokens/anonymous (Portal-style).
   */
  token?: FluxyTokenSource;
  /** Use partysocket auto-reconnect for room/user WebSockets (default false). */
  usePartySocket?: boolean;
}

function rememberPublicGuestKey(baseUrl: string, roomId: string, explicit?: string): string | undefined {
  if (explicit && /^[A-Za-z0-9_-]{16,128}$/.test(explicit)) return explicit;
  if (typeof localStorage === "undefined") {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
    return undefined;
  }
  const storageKey = `fluxy.guestKey.${baseUrl}.${roomId}`;
  let existing = localStorage.getItem(storageKey);
  if (!existing || !/^[A-Za-z0-9_-]{16,128}$/.test(existing)) {
    existing =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        : `${Date.now()}${Math.random().toString(36).slice(2, 18)}`;
    localStorage.setItem(storageKey, existing);
  }
  return existing;
}

export class FluxyChatClient {
  private baseUrl: string;
  private _userId: string;
  readonly apiKey?: string;
  private readonly credentials: FluxyClientCredentials | null;
  private readonly usePartySocket: boolean;

  constructor(options: FluxyChatClientOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl);
    this._userId = options.userId;
    this.apiKey = options.publishableKey ?? options.apiKey;
    this.usePartySocket = options.usePartySocket ?? false;
    if (this.apiKey) {
      this.credentials = new FluxyClientCredentials({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        token: options.token,
      });
    } else {
      this.credentials = null;
      if (typeof options.token === "string") {
        this._cachedToken = options.token;
      }
    }
  }

  private _cachedToken: string | undefined;

  /** Current bearer token (may be undefined until {@link resolveToken}). */
  get token(): string | undefined {
    return this.credentials?.getCachedToken() ?? this._cachedToken;
  }

  /** Effective user id (JWT `sub` after anonymous mint when applicable). */
  get userId(): string {
    return this.credentials?.getResolvedUserId(this._userId) ?? this._userId;
  }

  isAuthenticated(): boolean {
    if (this.token) return true;
    return Boolean(this.apiKey && this.credentials?.managed);
  }

  /** True when the SDK auto-mints anonymous credentials (apiKey, no user token). */
  isAnonymous(): boolean {
    return Boolean(this.credentials?.managed && this.token);
  }

  /** Resolve bearer token (mints anonymous JWT when configured). */
  async resolveToken(): Promise<string | undefined> {
    if (this.credentials) {
      const token = await this.credentials.resolve();
      const sub = decodeFluxyJwtPayload(token).sub;
      if (sub) this._userId = sub;
      return token;
    }
    return this._cachedToken;
  }

  /**
   * Replace session token (login/logout). Returns true when identity changed —
   * active connections should reconnect.
   */
  setToken(next: FluxyTokenSource | undefined): boolean {
    if (this.credentials) {
      const changed = this.credentials.setToken(next);
      const sub = this.token ? decodeFluxyJwtPayload(this.token).sub : undefined;
      if (sub) this._userId = sub;
      return changed;
    }
    const prev = this._cachedToken;
    if (typeof next === "string") this._cachedToken = next;
    else if (next === undefined) this._cachedToken = undefined;
    else this._cachedToken = undefined;
    const nextSub = typeof next === "string" ? decodeFluxyJwtPayload(next).sub : undefined;
    return decodeFluxyJwtPayload(prev ?? "").sub !== nextSub;
  }

  /** Alias of `setToken` — login, logout, or JWT refresh without recreating the client. */
  updateToken(next: FluxyTokenSource | undefined): boolean {
    return this.setToken(next);
  }

  /** Expire cached anonymous token so the next resolve re-mints (stable anonId). */
  invalidateCredential(): void {
    this.credentials?.invalidate();
  }

  /** Fetch public guest anti-spam config (Turnstile site key, rate limits). */
  static async fetchPublicGuestHardening(baseUrl: string): Promise<{
    ok: boolean;
    publicGuestEnabled: boolean;
    readOnlyGuest: boolean;
    rateLimitPerMinute: number;
    turnstile: {
      configured: boolean;
      required: boolean;
      siteKey: string | null;
    };
  }> {
    const url = new URL("/public/guest-hardening", trimTrailingSlashes(baseUrl));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch guest hardening config: ${res.status}`);
    return res.json();
  }

  /** Join a public room without an account (P10-SB6). No API key required. */
  static async joinPublicRoomAsGuest(
    baseUrl: string,
    roomId: string,
    opts?: { displayName?: string; turnstileToken?: string; guestKey?: string; publishableKey?: string },
  ): Promise<{
    token: string;
    userId: string;
    roomId: string;
    projectId: string;
    expiresIn: number;
    readOnly: boolean;
  }> {
    const guestKey = rememberPublicGuestKey(baseUrl, roomId, opts?.guestKey);
    const url = new URL(
      `/public/rooms/${encodeURIComponent(roomId)}/guest-session`,
      trimTrailingSlashes(baseUrl),
    );
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts?.publishableKey) headers["X-Fluxy-Api-Key"] = opts.publishableKey;
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        displayName: opts?.displayName,
        turnstileToken: opts?.turnstileToken,
        guestKey,
      }),
    });
    if (!res.ok) throw new Error(`Failed to join public room as guest: ${res.status}`);
    return res.json();
  }

  private authHeaders(): HeadersInit | undefined {
    if (this.token) {
      return {
        Authorization: `Bearer ${this.token}`,
      };
    }
    if (this.apiKey) {
      return {
        "X-Fluxy-Api-Key": this.apiKey,
      };
    }
    return undefined;
  }

  /**
   * Open a room WebSocket.
   *
   * SECURITY (SDK-1): the browser `WebSocket` API cannot send custom
   * headers, so the JWT is passed as the `token` query parameter. URLs
   * (including query strings) can be captured in reverse-proxy / CDN /
   * Cloudflare access logs and browser history. Mitigations:
   *   - Mint short-lived tokens (the Worker enforces `exp`).
   *   - Prefer dedicated, single-use connection tickets for the WS
   *     handshake instead of a long-lived session JWT where possible.
   * The same limitation applies to `connectSSE()` (EventSource).
   */
  connect(roomId: string, options?: FluxyWebSocketConnectOptions): WebSocket {
    const wsBase = httpUrlToWebSocketBase(this.baseUrl);
    const url = new URL(
      `/ws/room/${encodeURIComponent(roomId)}`,
      wsBase.endsWith("/") ? wsBase : `${wsBase}/`
    );
    if (this.apiKey) {
      url.searchParams.set("apiKey", this.apiKey);
    }
    if (this.token) {
      url.searchParams.set("token", this.token);
    }
    url.searchParams.set("userId", this.userId);
    if (options?.replay === "off") {
      url.searchParams.set("replay", "off");
    } else {
      if (options?.replay === "connect") {
        url.searchParams.set("replay", "connect");
      }
      if (options?.replayLimit != null && Number.isFinite(options.replayLimit)) {
        url.searchParams.set(
          "replayLimit",
          String(Math.max(1, Math.floor(options.replayLimit))),
        );
      }
    }
    if (options?.presenceInfo && Object.keys(options.presenceInfo).length) {
      url.searchParams.set("presenceInfo", JSON.stringify(options.presenceInfo));
    }
    if (options?.cache === "on") {
      url.searchParams.set("cache", "1");
    }
    if (options?.readonly) {
      url.searchParams.set("readonly", "1");
    }
    return createFluxyWebSocket(url.toString(), this.usePartySocket);
  }

  /**
   * Resilient room WebSocket with typed errors, exponential backoff reconnect,
   * and optional REST history replay after reconnect.
   */
  connectRoom(roomId: string, options?: FluxyRoomConnectionOptions): FluxyChatRoomConnection {
    return new FluxyChatRoomConnection(this, roomId, {
      usePartySocket: this.usePartySocket,
      ...options,
    });
  }

  /**
   * REST snapshot of who's connected in a room right now (Portal-style
   * `getParticipants()`). Aggregated across shards for supergroup rooms
   * (P10-SB8). Returns `members: [{ userId, userInfo }]` plus occupancy stats.
   */
  async getRoomLive(roomId: string): Promise<FluxyRoomLive> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) {
      return {
        roomId: "",
        shardCount: 1,
        occupied: false,
        subscriptionCount: 0,
        userCount: 0,
        online: 0,
        users: [],
        members: [],
        socketIds: [],
      };
    }
    const url = new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/live`, this.baseUrl);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch room live snapshot: ${res.status}`);
    const body = (await res.json()) as Partial<FluxyRoomLive>;
    return {
      roomId: body.roomId ?? trimmedRoomId,
      shardCount: Number(body.shardCount ?? 1),
      occupied: Boolean(body.occupied),
      subscriptionCount: Number(body.subscriptionCount ?? body.online ?? 0),
      userCount: Number(body.userCount ?? (Array.isArray(body.users) ? body.users.length : 0)),
      online: Number(body.online ?? 0),
      users: Array.isArray(body.users) ? body.users : [],
      members: Array.isArray(body.members)
        ? body.members
            .filter((m): m is FluxyRoomLiveMember => !!m && typeof m.userId === "string")
            .map((m) => ({
              userId: m.userId,
              ...(m.userInfo && typeof m.userInfo === "object" ? { userInfo: m.userInfo } : {}),
            }))
        : [],
      socketIds: Array.isArray(body.socketIds) ? body.socketIds : [],
    };
  }

  /**
   * Portal-style `getParticipants()` alias: returns the `members` slice
   * (userId + userInfo) for the room right now. Use `getRoomLive()` if you
   * also need `online` / `subscriptionCount` / `socketIds`.
   */
  async getRoomParticipants(roomId: string): Promise<FluxyRoomLiveMember[]> {
    const live = await this.getRoomLive(roomId);
    return live.members;
  }

  connectSSE(roomId: string): EventSource | null {
    if (!this.token) return null;
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/stream`, this.baseUrl);
    url.searchParams.set("token", this.token);
    url.searchParams.set("userId", this.userId);
    return new EventSource(url.toString());
  }

  async fetchMessages(
    roomId: string,
    limitOrOptions: number | FetchMessagesOptions = 50,
  ): Promise<FluxyChatMessage[]> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return [];

    const options: FetchMessagesOptions =
      typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
    const limit = clampHistoryLimit(options.limit);

    const url = new URL("/api/messages", this.baseUrl);
    url.searchParams.set("roomId", trimmedRoomId);
    url.searchParams.set("limit", String(limit));
    if (options.before?.trim()) {
      url.searchParams.set("before", options.before.trim());
    }
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
    const body = await res.json();
    // Store reactions from response for later access via getLastFetchReactions()
    if (body.reactions && typeof body.reactions === "object") {
      this._lastFetchReactions = body.reactions;
    }
    return sortMessagesChronological((body.messages ?? []) as FluxyChatMessage[]);
  }

  /** Yjs-encoded message-list snapshot from Room DO (offline merge). */
  async fetchMessageCrdtSnapshot(
    roomId: string,
  ): Promise<{ update: string; messageCount: number; roomId: string } | null> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId || !this.token) return null;
    const url = new URL(
      `/api/rooms/${encodeURIComponent(trimmedRoomId)}/messages/crdt-snapshot`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch message CRDT snapshot: ${res.status}`);
    return res.json();
  }

  /** Reactions map from the most recent fetchMessages call. */
  private _lastFetchReactions: Record<number, Record<string, number>> = {};
  get lastFetchReactions(): Record<number, Record<string, number>> {
    return this._lastFetchReactions;
  }

  /**
   * Pusher-style HTTP trigger: broadcast an event to multiple rooms.
   * Requires JWT; caller must be a member of each room (or project admin/owner).
   */
  async triggerEvents(options: {
    roomIds: string[];
    name?: string;
    data?: unknown;
    event?: Record<string, unknown>;
    excludeSocketId?: string;
  }): Promise<{ ok: boolean; triggered: string[]; failed?: string[] }> {
    if (!this.token) {
      throw new Error("triggerEvents requires a JWT token");
    }
    const res = await fetch(new URL("/events", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomIds: options.roomIds,
        name: options.name,
        data: options.data,
        event: options.event,
        excludeSocketId: options.excludeSocketId,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `triggerEvents failed: ${res.status}`,
      );
    }
    return body as { ok: boolean; triggered: string[]; failed?: string[] };
  }

  /**
   * Mint a member JWT via API key (Pusher-style user sign-in).
   * Returns token plus user-channel paths for WS + HTTP events.
   */
  async signIn(options?: {
    userId?: string;
    roles?: string[];
    ttlSeconds?: number;
  }): Promise<FluxySignInResponse> {
    if (!this.apiKey) {
      throw new Error("signIn requires apiKey on FluxyChatClient");
    }
    if (this.apiKey.startsWith("pk_")) {
      throw new Error("signIn requires a secret fc_ key. pk_ is publishable (guest / anonymous only).");
    }
    const res = await fetch(new URL("/auth/signin", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluxy-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        userId: options?.userId ?? this.userId,
        roles: options?.roles,
        ttlSeconds: options?.ttlSeconds,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string" ? body.error : `signIn failed: ${res.status}`,
      );
    }
    return body as FluxySignInResponse;
  }

  /** WebSocket to the per-user channel (`/ws/user/:userId`). JWT `sub` must match userId. */
  connectUser(userId?: string): WebSocket {
    const uid = (userId ?? this.userId).trim();
    const wsBase = httpUrlToWebSocketBase(this.baseUrl);
    const url = new URL(
      `/ws/user/${encodeURIComponent(uid)}`,
      wsBase.endsWith("/") ? wsBase : `${wsBase}/`,
    );
    if (this.apiKey) url.searchParams.set("apiKey", this.apiKey);
    if (this.token) url.searchParams.set("token", this.token);
    url.searchParams.set("userId", uid);
    return createFluxyWebSocket(url.toString(), this.usePartySocket);
  }

  /** Dedicated inbox socket (`GET /ws/inbox?token=`). Same User DO as `/ws/user/:id`; inbox-only frames. */
  connectInbox(): WebSocket {
    const wsBase = httpUrlToWebSocketBase(this.baseUrl);
    const url = new URL("/ws/inbox", wsBase.endsWith("/") ? wsBase : `${wsBase}/`);
    if (this.apiKey) url.searchParams.set("apiKey", this.apiKey);
    if (this.token) url.searchParams.set("token", this.token);
    if (this.userId) url.searchParams.set("userId", this.userId);
    return createFluxyWebSocket(url.toString(), this.usePartySocket);
  }

  /**
   * Room extension snapshot (`GET /rooms/:id/extensions`). Max 5 declared kv/counter slots.
   */
  async getRoomExtensions(roomId: string): Promise<{
    roomId: string;
    ext: Record<string, { kind?: string; data?: unknown; updatedAt?: string }>;
    declared: Array<{ id: string; kind: string }>;
  }> {
    const trimmed = roomId.trim();
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(trimmed)}/extensions`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    const body = (await res.json().catch(() => ({}))) as {
      roomId?: string;
      ext?: Record<string, { kind?: string; data?: unknown; updatedAt?: string }>;
      declared?: Array<{ id: string; kind: string }>;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : `getRoomExtensions failed: ${res.status}`);
    }
    return {
      roomId: body.roomId ?? trimmed,
      ext: body.ext && typeof body.ext === "object" ? body.ext : {},
      declared: Array.isArray(body.declared) ? body.declared : [],
    };
  }

  /** PUT `/rooms/:id/extensions/:extId`. Hosted: id must be declared on fluxy deploy rooms overlay. */
  async setRoomExtension(
    roomId: string,
    extId: string,
    body: { kind?: "kv" | "counter"; data?: unknown; delta?: number },
  ): Promise<{
    ok: boolean;
    id: string;
    record: { kind?: string; data?: unknown; updatedAt?: string };
    ext: Record<string, unknown>;
  }> {
    const res = await fetch(
      new URL(
        `/rooms/${encodeURIComponent(roomId.trim())}/extensions/${encodeURIComponent(extId.trim())}`,
        this.baseUrl,
      ).toString(),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(body ?? {}),
      },
    );
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      record?: { kind?: string; data?: unknown; updatedAt?: string };
      ext?: Record<string, unknown>;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : `setRoomExtension failed: ${res.status}`);
    }
    return {
      ok: payload.ok !== false,
      id: payload.id ?? extId,
      record: payload.record ?? { data: null },
      ext: payload.ext && typeof payload.ext === "object" ? payload.ext : {},
    };
  }

  /**
   * Deliver an event to a user (user channel WS + optional room fanout).
   * Caller must be the same user or project admin/owner.
   */
  async triggerUserEvent(
    targetUserId: string,
    options: {
      name: string;
      data?: unknown;
      excludeSocketId?: string;
      /** When true (default), also deliver on room sockets the user is subscribed to. */
      fanoutRooms?: boolean;
    },
  ): Promise<{
    ok: boolean;
    userId: string;
    delivered: { userChannel: number; rooms: number };
  }> {
    if (!this.token) {
      throw new Error("triggerUserEvent requires a JWT token");
    }
    const res = await fetch(
      new URL(`/users/${encodeURIComponent(targetUserId)}/events`, this.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders(),
        },
        body: JSON.stringify({
          name: options.name,
          data: options.data,
          excludeSocketId: options.excludeSocketId,
          fanoutRooms: options.fanoutRooms,
        }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `triggerUserEvent failed: ${res.status}`,
      );
    }
    return body as {
      ok: boolean;
      userId: string;
      delivered: { userChannel: number; rooms: number };
    };
  }

  /** Terminate all WebSocket connections for a user (admin/owner or self). */
  async terminateUserConnections(targetUserId: string): Promise<{
    ok: boolean;
    userId: string;
    closed: { userChannel: number; roomSockets: number };
  }> {
    if (!this.token) {
      throw new Error("terminateUserConnections requires a JWT token");
    }
    const res = await fetch(
      new URL(`/users/${encodeURIComponent(targetUserId)}/connections`, this.baseUrl).toString(),
      {
        method: "DELETE",
        headers: this.authHeaders(),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `terminateUserConnections failed: ${res.status}`,
      );
    }
    return body as {
      ok: boolean;
      userId: string;
      closed: { userChannel: number; roomSockets: number };
    };
  }

  async getWatchlist(userId?: string): Promise<{
    userId: string;
    targets: Array<{ type: string; targetId: string; createdAt: string }>;
  }> {
    if (!this.token) throw new Error("getWatchlist requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const res = await fetch(new URL(`/users/${uid}/watchlist`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getWatchlist failed: ${res.status}`);
    return res.json();
  }

  async addWatchlistTarget(
    target: { type: "room" | "user"; targetId: string },
    userId?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("addWatchlistTarget requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const res = await fetch(new URL(`/users/${uid}/watchlist`, this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(target),
    });
    if (!res.ok) throw new Error(`addWatchlistTarget failed: ${res.status}`);
    return res.json();
  }

  async removeWatchlistTarget(
    target: { type: "room" | "user"; targetId: string },
    userId?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("removeWatchlistTarget requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const url = new URL(`/users/${uid}/watchlist`, this.baseUrl);
    url.searchParams.set("type", target.type);
    url.searchParams.set("targetId", target.targetId);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`removeWatchlistTarget failed: ${res.status}`);
    return res.json();
  }

  async listMessageTemplates(): Promise<import("./message-template").FluxyMessageTemplate[]> {
    if (!this.token) return [];
    const res = await fetch(new URL("/templates", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
    const body = await res.json();
    return body.templates ?? [];
  }

  async createMessageTemplate(
    name: string,
    body: string,
  ): Promise<import("./message-template").FluxyMessageTemplate | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/templates", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ name, body }),
    });
    if (!res.ok) throw new Error(`Failed to create template: ${res.status}`);
    const json = await res.json();
    return json.template ?? null;
  }

  async updateMessageTemplate(
    templateId: string,
    patch: { name?: string; body?: string },
  ): Promise<import("./message-template").FluxyMessageTemplate | null> {
    if (!this.token) return null;
    const url = new URL(`/templates/${encodeURIComponent(templateId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update template: ${res.status}`);
    const json = await res.json();
    return json.template ?? null;
  }

  async deleteMessageTemplate(templateId: string): Promise<boolean> {
    if (!this.token) return false;
    const url = new URL(`/templates/${encodeURIComponent(templateId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    return res.ok;
  }

  async renderMessageTemplate(options: {
    templateId?: string;
    body?: string;
    vars?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<string> {
    if (!this.token) throw new Error("JWT is required to render templates");
    const res = await fetch(new URL("/templates/render", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        templateId: options.templateId,
        body: options.body,
        vars: options.vars,
        templateVars: options.vars,
      }),
    });
    if (!res.ok) throw new Error(`Failed to render template: ${res.status}`);
    const json = await res.json();
    return String(json.content ?? "");
  }

  async listActivities(options?: {
    limit?: number;
    roomId?: string;
  }): Promise<import("./message-template").FluxyProjectActivity[]> {
    if (!this.token) return [];
    const url = new URL("/activities", this.baseUrl);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    if (options?.roomId?.trim()) url.searchParams.set("roomId", options.roomId.trim());
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list activities: ${res.status}`);
    const body = await res.json();
    return body.activities ?? [];
  }

  async updateMemberPreferences(
    roomId: string,
    patch: { notifyEnabled?: boolean; preferences?: Record<string, unknown> },
  ): Promise<FluxyRoomMember | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/members/me/preferences`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update member preferences: ${res.status}`);
    const body = await res.json();
    const member = body.member;
    if (!member) return null;
    return normalizeRoomMembers([member])[0] ?? null;
  }

  async fetchRoomMembers(roomId: string): Promise<FluxyRoomMember[]> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return [];
    const url = new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/members`, this.baseUrl);
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch room members: ${res.status}`);
    const body = await res.json();
    return normalizeRoomMembers(body.members ?? []);
  }

  /** Fetch optional room E2E key (members only, when room has `e2eEnabled`). */
  async getRoomE2eKey(
    roomId: string,
  ): Promise<{ e2eEnabled: boolean; e2eKey?: string } | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return null;
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/e2e-key`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ e2eEnabled: boolean; e2eKey?: string }>;
  }

  /** Alias for {@link fetchMessages} â€” chronological room history via REST. */
  fetchRoomHistory(
    roomId: string,
    options?: FetchMessagesOptions,
  ): Promise<FluxyChatMessage[]> {
    return this.fetchMessages(roomId, options ?? {});
  }

  async listRooms(type?: string): Promise<FluxyChatRoom[]> {
    const url = new URL("/rooms", this.baseUrl);
    if (type) url.searchParams.set("type", type);
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load rooms: ${res.status}`);
    const body = await res.json();
    return body.rooms ?? [];
  }

  /** CP-063: Open or resolve a DM thread (web → D1 room; external → adapter). */
  async openDM(userId: string): Promise<{
    ok: boolean;
    thread: { id: string; adapterSlug: string; channelId: string; roomId?: string; created?: boolean };
    room?: { id: string; type: string };
  }> {
    if (!this.token) throw new Error("openDM requires JWT token");
    const res = await fetch(new URL("/chat/open-dm", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        ...(this.authHeaders() as Record<string, string>),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`openDM failed: ${res.status} ${(err as { error?: string }).error || ""}`);
    }
    return res.json();
  }

  // --- Authenticated REST helpers (used opportunistically by hooks) ---

  async createMessage(
    roomId: string,
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
    clientMessageId?: string,
    options?: import("./message-template").FluxySendMessageOptions,
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/messages", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        content: options?.templateId ? content || "" : content,
        replyTo: replyTo ?? null,
        ...(attachments?.length ? { attachments } : {}),
        ...(clientMessageId?.trim() ? { clientMessageId: clientMessageId.trim() } : {}),
        ...(options?.templateId ? { templateId: options.templateId } : {}),
        ...(options?.templateVars ? { templateVars: options.templateVars } : {}),
        ...(options?.expiresInSeconds != null
          ? { expiresInSeconds: options.expiresInSeconds }
          : {}),
        ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
        ...(options?.visibility ? { visibility: options.visibility } : {}),
        ...(options?.visibleTo?.length ? { visibleTo: options.visibleTo } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create message: ${res.status}`);
    }
    const body = await res.json();
    return body.message ?? null;
  }

  async listCommentThreads(roomId: string): Promise<FluxyCommentThread[]> {
    if (!this.token) return [];
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(roomId)}/comment-threads`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) throw new Error(`listCommentThreads failed: ${res.status}`);
    const json = (await res.json()) as { threads?: FluxyCommentThread[] };
    return json.threads ?? [];
  }

  async createCommentThread(
    roomId: string,
    input: { body: string; metadata?: FluxyCommentThreadMetadata },
  ): Promise<FluxyCommentThread | null> {
    if (!this.token) return null;
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(roomId)}/comment-threads`, this.baseUrl).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(`createCommentThread failed: ${res.status}`);
    const json = (await res.json()) as { thread?: FluxyCommentThread };
    return json.thread ?? null;
  }

  async createComment(
    roomId: string,
    threadId: string,
    body: string,
  ): Promise<FluxyComment | null> {
    if (!this.token) return null;
    const res = await fetch(
      new URL(
        `/rooms/${encodeURIComponent(roomId)}/comment-threads/${encodeURIComponent(threadId)}/comments`,
        this.baseUrl,
      ).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({ body }),
      },
    );
    if (!res.ok) throw new Error(`createComment failed: ${res.status}`);
    const json = (await res.json()) as { comment?: FluxyComment };
    return json.comment ?? null;
  }

  async markThreadAsResolved(roomId: string, threadId: string, resolved = true): Promise<void> {
    if (!this.token) return;
    const res = await fetch(
      new URL(
        `/rooms/${encodeURIComponent(roomId)}/comment-threads/${encodeURIComponent(threadId)}`,
        this.baseUrl,
      ).toString(),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({ resolved }),
      },
    );
    if (!res.ok) throw new Error(`markThreadAsResolved failed: ${res.status}`);
  }

  async listFeeds(roomId: string): Promise<FluxyFeed[]> {
    if (!this.token && !this.apiKey) return [];
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(roomId)}/feeds`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) throw new Error(`listFeeds failed: ${res.status}`);
    const json = (await res.json()) as { feeds?: FluxyFeed[] };
    return json.feeds ?? [];
  }

  async createFeed(
    roomId: string,
    input: { name: string; kind?: string },
  ): Promise<FluxyFeed | null> {
    if (!this.token && !this.apiKey) return null;
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(roomId)}/feeds`, this.baseUrl).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(`createFeed failed: ${res.status}`);
    const json = (await res.json()) as { feed?: FluxyFeed };
    return json.feed ?? null;
  }

  async listFeedMessages(roomId: string, feedId: string): Promise<FluxyFeedMessage[]> {
    if (!this.token && !this.apiKey) return [];
    const res = await fetch(
      new URL(
        `/rooms/${encodeURIComponent(roomId)}/feeds/${encodeURIComponent(feedId)}/messages`,
        this.baseUrl,
      ).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) throw new Error(`listFeedMessages failed: ${res.status}`);
    const json = (await res.json()) as { messages?: FluxyFeedMessage[] };
    return json.messages ?? [];
  }

  async createFeedMessage(
    roomId: string,
    feedId: string,
    input: { body: string; metadata?: FluxyFeedMessageMetadata },
  ): Promise<FluxyFeedMessage | null> {
    if (!this.token && !this.apiKey) return null;
    const res = await fetch(
      new URL(
        `/rooms/${encodeURIComponent(roomId)}/feeds/${encodeURIComponent(feedId)}/messages`,
        this.baseUrl,
      ).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(`createFeedMessage failed: ${res.status}`);
    const json = (await res.json()) as { message?: FluxyFeedMessage };
    return json.message ?? null;
  }

  /** Ephemeral whisper — visible only to `visibleToUserId` (Portal B-10). */
  async postEphemeral(
    roomId: string,
    content: string,
    visibleToUserId: string,
    options?: { expiresInSeconds?: number },
  ): Promise<FluxyChatMessage | null> {
    return this.createMessage(roomId, content, null, undefined, undefined, {
      visibility: "whisper",
      visibleTo: [visibleToUserId],
      expiresInSeconds: options?.expiresInSeconds ?? 3600,
    });
  }

  /** Send rich interactive card (Portal B-1). */
  async sendCard(
    roomId: string,
    card: import("./cards").CardElement,
    options?: { parentId?: number | null },
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/api/cards/send", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ roomId, card, parentId: options?.parentId ?? null }),
    });
    if (!res.ok) throw new Error(`sendCard failed: ${res.status}`);
    const body = (await res.json()) as { message?: FluxyChatMessage };
    return body.message ?? null;
  }

  /** Chat history → AI SDK messages (Portal B-2). */
  async toAiMessagesFromRoom(
    roomId: string,
    options?: import("./messages-to-ai").ToAiMessagesOptions,
  ) {
    const { toAiMessages } = await import("./messages-to-ai");
    const messages = await this.fetchMessages(roomId, { limit: 50 });
    return toAiMessages(messages, options);
  }

  /** Per-thread typed KV state (Portal B-5). */
  async getThreadState<T = Record<string, unknown>>(threadId: string): Promise<T | null> {
    if (!this.token) return null;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { state?: T | null };
    return body.state ?? null;
  }

  async setThreadState(
    threadId: string,
    state: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<boolean> {
    if (!this.token) return false;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({ state, ttlMs }),
      },
    );
    return res.ok;
  }

  async deleteThreadState(threadId: string): Promise<boolean> {
    if (!this.token) return false;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      { method: "DELETE", headers: this.authHeaders() },
    );
    return res.ok;
  }

  /**
   * Upload a recorded voice message to `POST /messages/voice` (P12-B).
   *
   * The Worker stores the audio in R2, broadcasts a `message` event with
   * `kind: "voice"` and `transcriptionStatus: "pending"`, then runs the
   * async transcription and broadcasts a `message_updated` event with the
   * transcript a few seconds later. Subscribe to the room session events
   * to surface the transcript inline.
   *
   * @param roomId  Target room.
   * @param audio   A `Blob` / `File` recorded with `MediaRecorder`
   *                (webm/ogg/mp3/m4a/wav; max 10 MB; max 10 min).
   * @param options Optional `parentId` (reply target), `durationMs`
   *                (client-measured length), and `clientMessageId`
   *                (optimistic-UI id).
   * @returns The created message envelope with `kind: "voice"` and
   *          `transcriptionStatus: "pending"`, or `null` if no JWT is set.
   */
  async sendVoiceMessage(
    roomId: string,
    audio: Blob,
    options?: { parentId?: number | null; durationMs?: number | null; clientMessageId?: string | null },
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) return null;
    const form = new FormData();
    const baseMime = audio.type?.split(";")[0]?.trim() || "audio/webm";
    const uploadBlob =
      audio instanceof File && audio.type === baseMime
        ? audio
        : new File([audio], "voice.webm", { type: baseMime });
    form.append("audio", uploadBlob);
    form.append("roomId", trimmedRoomId);
    if (options?.parentId != null) form.append("parentId", String(options.parentId));
    if (options?.durationMs != null) form.append("durationMs", String(options.durationMs));
    if (options?.clientMessageId?.trim()) {
      form.append("clientMessageId", options.clientMessageId.trim());
    }
    const url = new URL("/messages/voice", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.authHeaders() },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`sendVoiceMessage failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      messageId: number;
      kind: "voice";
      audioUrl: string;
      durationMs?: number | null;
      transcriptionStatus: "pending" | "done" | "failed";
      createdAt: string;
    };
    return {
      id: body.messageId,
      roomId: trimmedRoomId,
      userId: this.userId,
      content: "",
      createdAt: body.createdAt,
      parentId: options?.parentId ?? null,
      kind: "voice",
      audioUrl: body.audioUrl,
      audioMimeType: audio.type || null,
      audioSizeBytes: audio.size,
      durationMs: body.durationMs ?? null,
      transcription: null,
      transcriptionStatus: body.transcriptionStatus,
      clientMessageId: options?.clientMessageId ?? undefined,
    };
  }

  /**
   * Request AI reply suggestions for a room.
   *
   * @param roomId   The room to generate suggestions for.
   * @param parentId Optional reply-target message id for context.
   * @returns Up to 3 short suggestion strings, or `null` if no JWT.
   */
  /**
   * Summarize a reply thread anchored at a message (P12-M).
   */
  async summarizeThread(
    messageId: number,
    roomId: string,
  ): Promise<{
    summary: string;
    rootMessageId: number;
    messageCount: number;
    truncated?: boolean;
  } | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId || !Number.isFinite(messageId) || messageId <= 0) return null;
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/summary`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomId: trimmedRoomId }),
    });
    if (!res.ok) {
      throw new Error(`summarizeThread failed: ${res.status}`);
    }
    return (await res.json()) as {
      summary: string;
      rootMessageId: number;
      messageCount: number;
      truncated?: boolean;
    };
  }

  async suggestReplies(
    roomId: string,
    parentId?: number | null,
  ): Promise<string[] | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) return null;
    const url = new URL("/messages/suggest-replies", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: trimmedRoomId,
        ...(parentId != null ? { parentId } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`suggestReplies failed: ${res.status}`);
    }
    const body = (await res.json()) as { suggestions?: string[] };
    return Array.isArray(body.suggestions) ? body.suggestions : [];
  }

  /** Daily digest preferences (P12-F). */
  async getDigestPreferences(): Promise<{
    enabled: boolean;
    email: string | null;
    emailEnabled: boolean;
    webPushEnabled: boolean;
    inAppEnabled: boolean;
    updatedAt: string | null;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/digest/preferences", this.baseUrl).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getDigestPreferences failed: ${res.status}`);
    const body = (await res.json()) as { preferences?: Record<string, unknown> };
    const p = body.preferences || {};
    return {
      enabled: Boolean(p.enabled),
      email: typeof p.email === "string" ? p.email : null,
      emailEnabled: p.emailEnabled !== false,
      webPushEnabled: p.webPushEnabled !== false,
      inAppEnabled: p.inAppEnabled !== false,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
    };
  }

  /** Quiet hours + batched notifications (P12-N). */
  async getQuietHoursPreferences(): Promise<{
    preferences: FluxyQuietHoursPreferences;
    pendingBatch: number;
    inQuietHours: boolean;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/quiet-hours", this.baseUrl).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getQuietHoursPreferences failed: ${res.status}`);
    return (await res.json()) as {
      preferences: FluxyQuietHoursPreferences;
      pendingBatch: number;
      inQuietHours: boolean;
    };
  }

  async updateQuietHoursPreferences(patch: {
    enabled?: boolean;
    timezone?: string;
    quietStart?: string;
    quietEnd?: string;
    batchPush?: boolean;
    batchInApp?: boolean;
  }): Promise<{
    preferences: FluxyQuietHoursPreferences;
    pendingBatch: number;
    inQuietHours: boolean;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/quiet-hours", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateQuietHoursPreferences failed: ${res.status}`);
    return (await res.json()) as {
      preferences: FluxyQuietHoursPreferences;
      pendingBatch: number;
      inQuietHours: boolean;
    };
  }

  async flushNotificationBatch(): Promise<{
    ok: boolean;
    flushed: number;
    push?: number;
    inApp?: number;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/flush-batch", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`flushNotificationBatch failed: ${res.status}`);
    return (await res.json()) as {
      ok: boolean;
      flushed: number;
      push?: number;
      inApp?: number;
    };
  }

  async updateDigestPreferences(patch: {
    enabled?: boolean;
    email?: string | null;
    emailEnabled?: boolean;
    webPushEnabled?: boolean;
    inAppEnabled?: boolean;
  }): Promise<{
    enabled: boolean;
    email: string | null;
    emailEnabled: boolean;
    webPushEnabled: boolean;
    inAppEnabled: boolean;
    updatedAt: string | null;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/digest/preferences", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateDigestPreferences failed: ${res.status}`);
    const body = (await res.json()) as { preferences?: Record<string, unknown> };
    const p = body.preferences || {};
    return {
      enabled: Boolean(p.enabled),
      email: typeof p.email === "string" ? p.email : null,
      emailEnabled: p.emailEnabled !== false,
      webPushEnabled: p.webPushEnabled !== false,
      inAppEnabled: p.inAppEnabled !== false,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
    };
  }

  /** Full-text message search (P12-E). Use `mode: "hybrid"` for semantic+keyword when enabled. */
  async searchMessages(
    query: string,
    options?: {
      roomId?: string;
      from?: string;
      to?: string;
      limit?: number;
      mode?: "keyword" | "hybrid" | "semantic";
    },
  ): Promise<{ query: string; mode?: string; results: Array<{
    id: number;
    roomId: string;
    userId: string;
    content: string;
    createdAt: string;
    snippet: string;
    score?: number;
  }> } | null> {
    if (!this.token) return null;
    const trimmed = query?.trim();
    if (!trimmed) return { query: "", results: [] };

    const mode = options?.mode ?? "keyword";
    if (mode === "hybrid" || mode === "semantic") {
      return this.searchMessagesSemantic(trimmed, {
        roomId: options?.roomId,
        from: options?.from,
        to: options?.to,
        limit: options?.limit,
        mode,
      });
    }

    const url = new URL("/search/messages", this.baseUrl);
    url.searchParams.set("q", trimmed);
    if (options?.roomId) url.searchParams.set("roomId", options.roomId);
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`searchMessages failed: ${res.status}`);
    return (await res.json()) as {
      query: string;
      mode?: string;
      results: Array<{
        id: number;
        roomId: string;
        userId: string;
        content: string;
        createdAt: string;
        snippet: string;
        score?: number;
      }>;
    };
  }

  /** Semantic / hybrid message search (P15-F). Requires SEMANTIC_SEARCH_ENABLED + project toggle. */
  async searchMessagesSemantic(
    query: string,
    options?: {
      roomId?: string;
      from?: string;
      to?: string;
      limit?: number;
      mode?: "hybrid" | "semantic";
    },
  ): Promise<{ query: string; mode: string; results: Array<{
    id: number;
    roomId: string;
    userId: string;
    content: string;
    createdAt: string;
    snippet: string;
    score?: number;
  }> } | null> {
    if (!this.token) return null;
    const trimmed = query?.trim();
    if (!trimmed) return { query: "", mode: options?.mode ?? "hybrid", results: [] };

    const res = await fetch(`${this.baseUrl}/search/messages/semantic`, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        roomId: options?.roomId,
        from: options?.from,
        to: options?.to,
        limit: options?.limit,
        mode: options?.mode ?? "hybrid",
      }),
    });

    if (res.status === 404) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "semantic_search_disabled") {
        const fallback = await this.searchMessages(trimmed, {
          roomId: options?.roomId,
          from: options?.from,
          to: options?.to,
          limit: options?.limit,
          mode: "keyword",
        });
        if (!fallback) return null;
        return { ...fallback, mode: fallback.mode ?? "keyword" };
      }
    }

    if (!res.ok) throw new Error(`searchMessagesSemantic failed: ${res.status}`);
    return (await res.json()) as {
      query: string;
      mode: string;
      results: Array<{
        id: number;
        roomId: string;
        userId: string;
        content: string;
        createdAt: string;
        snippet: string;
        score?: number;
      }>;
    };
  }

  /** Project semantic search settings and embedding stats. */
  async getSemanticSearchSettings(): Promise<{
    settings: {
      globalEnabled: boolean;
      enabled: boolean;
      autoEmbed: boolean;
      defaultMode: "keyword" | "hybrid" | "semantic";
      embeddingCount: number;
      updatedAt: string | null;
      available: boolean;
    };
  } | null> {
    if (!this.token) return null;
    const res = await fetch(`${this.baseUrl}/search/settings`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getSemanticSearchSettings failed: ${res.status}`);
    return (await res.json()) as {
      settings: {
        globalEnabled: boolean;
        enabled: boolean;
        autoEmbed: boolean;
        defaultMode: "keyword" | "hybrid" | "semantic";
        embeddingCount: number;
        updatedAt: string | null;
        available: boolean;
      };
    };
  }

  /** Admin: update semantic search settings for the project. */
  async updateSemanticSearchSettings(input: {
    enabled?: boolean;
    autoEmbed?: boolean;
    defaultMode?: "keyword" | "hybrid" | "semantic";
  }): Promise<{
    settings: {
      globalEnabled: boolean;
      enabled: boolean;
      autoEmbed: boolean;
      defaultMode: "keyword" | "hybrid" | "semantic";
      embeddingCount: number;
      updatedAt: string | null;
      available: boolean;
    };
  } | null> {
    if (!this.token) return null;
    const res = await fetch(`${this.baseUrl}/admin/search/settings`, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateSemanticSearchSettings failed: ${res.status}`);
    return (await res.json()) as {
      settings: {
        globalEnabled: boolean;
        enabled: boolean;
        autoEmbed: boolean;
        defaultMode: "keyword" | "hybrid" | "semantic";
        embeddingCount: number;
        updatedAt: string | null;
        available: boolean;
      };
    };
  }

  /** Admin: backfill embeddings for messages missing vectors. */
  async backfillMessageEmbeddings(options?: {
    roomId?: string;
    limit?: number;
  }): Promise<{ ok: boolean; processed: number; stored: number; skipped: number; embeddingCount: number } | null> {
    if (!this.token) return null;
    const res = await fetch(`${this.baseUrl}/search/messages/backfill`, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    });
    if (!res.ok) throw new Error(`backfillMessageEmbeddings failed: ${res.status}`);
    return (await res.json()) as {
      ok: boolean;
      processed: number;
      stored: number;
      skipped: number;
      embeddingCount: number;
    };
  }

  /** Unified inbox summary (P12-C). Optional `where` filter (Portal §6) — server-side when passed as query params. */
  async getInbox(query?: FluxyInboxQuery): Promise<FluxyInboxSummary | null> {
    await this.resolveToken();
    if (!this.token) return null;
    const url = new URL("/inbox", this.baseUrl);
    if (query?.roomId) url.searchParams.set("roomId", query.roomId);
    if (query?.where) url.searchParams.set("where", JSON.stringify(query.where));
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getInbox failed: ${res.status}`);
    return (await res.json()) as FluxyInboxSummary;
  }

  async snoozeRoom(
    roomId: string,
    options: { until?: string; minutes?: number; hours?: number },
  ): Promise<{ ok: boolean; snoozeUntil?: string } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/inbox/rooms/${encodeURIComponent(roomId)}/snooze`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`snoozeRoom failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; snoozeUntil?: string };
  }

  async unsnoozeRoom(roomId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/inbox/rooms/${encodeURIComponent(roomId)}/snooze`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "DELETE", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`unsnoozeRoom failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async createInboxFollowUp(input: {
    roomId: string;
    messageId?: number | null;
    note?: string | null;
    dueAt?: string | null;
  }): Promise<{ ok: boolean; id: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/inbox/follow-ups", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createInboxFollowUp failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; id: string };
  }

  async completeInboxFollowUp(id: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/inbox/follow-ups/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (!res.ok) throw new Error(`completeInboxFollowUp failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  /** Agent task queue (P13-T4) â€” requires moderator/admin/owner JWT. */
  async getAgentQueue(options?: {
    status?: "resolved" | "cancelled";
    assignee?: "me" | "all";
    limit?: number;
  }): Promise<FluxyAgentQueueSummary | null> {
    if (!this.token) return null;
    const url = new URL("/agent-queue", this.baseUrl);
    if (options?.status) url.searchParams.set("status", options.status);
    if (options?.assignee) url.searchParams.set("assignee", options.assignee);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getAgentQueue failed: ${res.status}`);
    return (await res.json()) as FluxyAgentQueueSummary;
  }

  async createAgentTask(input: {
    roomId: string;
    note?: string | null;
    priority?: number;
    slaMinutes?: number;
  }): Promise<FluxyAgentTask | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/agent-queue", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createAgentTask failed: ${res.status}`);
    return (await res.json()) as FluxyAgentTask;
  }

  async claimAgentTask(taskId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/agent-queue/${encodeURIComponent(taskId)}/claim`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "POST", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`claimAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async releaseAgentTask(taskId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/agent-queue/${encodeURIComponent(taskId)}/release`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "POST", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`releaseAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async resolveAgentTask(
    taskId: string,
    input: { status: "resolved" | "cancelled"; disposition?: string | null },
  ): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/agent-queue/${encodeURIComponent(taskId)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`resolveAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async getAgentDispositions(): Promise<{ dispositions: FluxyAgentDisposition[] } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/agent-queue/dispositions", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getAgentDispositions failed: ${res.status}`);
    return (await res.json()) as { dispositions: FluxyAgentDisposition[] };
  }

  async getAgentQueueStats(): Promise<{
    total: number;
    breakdown: Array<FluxyAgentDisposition & { count: number }>;
    unknown: Array<{ code: string; count: number }>;
  } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/agent-queue/stats", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getAgentQueueStats failed: ${res.status}`);
    return (await res.json()) as {
      total: number;
      breakdown: Array<FluxyAgentDisposition & { count: number }>;
      unknown: Array<{ code: string; count: number }>;
    };
  }

  async getRoomHandoff(roomId: string): Promise<{
    handoff: FluxyRoomHandoffState;
    dispositions?: FluxyAgentDisposition[];
  } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getRoomHandoff failed: ${res.status}`);
    return (await res.json()) as {
      handoff: FluxyRoomHandoffState;
      dispositions?: FluxyAgentDisposition[];
    };
  }

  async requestRoomHandoff(
    roomId: string,
    input?: { agentId?: string; note?: string | null },
  ): Promise<{ ok: boolean; handoff?: FluxyRoomHandoffState } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) throw new Error(`requestRoomHandoff failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; handoff?: FluxyRoomHandoffState };
  }

  async listCustomDomains(): Promise<{ domains: FluxyCustomDomain[] } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/custom-domains", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`listCustomDomains failed: ${res.status}`);
    return (await res.json()) as { domains: FluxyCustomDomain[] };
  }

  async createCustomDomain(input: {
    hostname: string;
    defaultRoomId?: string | null;
    brandName?: string | null;
    brandLogoUrl?: string | null;
    allowedOrigins?: string[];
  }): Promise<FluxyCustomDomain | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/custom-domains", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createCustomDomain failed: ${res.status}`);
    return (await res.json()) as FluxyCustomDomain;
  }

  async updateCustomDomain(
    id: string,
    input: {
      status?: "pending" | "active" | "disabled";
      defaultRoomId?: string | null;
      brandName?: string | null;
      brandLogoUrl?: string | null;
      allowedOrigins?: string[];
    },
  ): Promise<FluxyCustomDomain | null> {
    if (!this.token) return null;
    const url = new URL(`/admin/custom-domains/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateCustomDomain failed: ${res.status}`);
    return (await res.json()) as FluxyCustomDomain;
  }

  async deleteCustomDomain(id: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/admin/custom-domains/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, { method: "DELETE", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`deleteCustomDomain failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async getPublicHostConfig(): Promise<FluxyPublicHostConfig | null> {
    const res = await fetch(new URL("/public/host-config", this.baseUrl).toString());
    if (!res.ok) throw new Error(`getPublicHostConfig failed: ${res.status}`);
    return (await res.json()) as FluxyPublicHostConfig;
  }

  /** P12-J â€” Flagship flags with env fallback; optional JWT for user targeting. */
  async getFeatureFlags(): Promise<FluxyClientFeatureFlags> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(new URL("/client/feature-flags", this.baseUrl).toString(), {
      headers,
    });
    if (!res.ok) throw new Error(`getFeatureFlags failed: ${res.status}`);
    return (await res.json()) as FluxyClientFeatureFlags;
  }

  /** Server-authored SDK defaults from `fluxy.config` (`GET /config/client`). */
  async getClientConfig(): Promise<{
    client: import("@fluxy-chat/config").FluxyClientDefaults;
    source: string;
  } | null> {
    const res = await fetch(new URL("/config/client", this.baseUrl).toString());
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getClientConfig failed: ${res.status}`);
    return (await res.json()) as {
      client: import("@fluxy-chat/config").FluxyClientDefaults;
      source: string;
    };
  }

  async getEmbedConfig(): Promise<{ config: FluxyEmbedConfig; snippet: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/embed-config", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getEmbedConfig failed: ${res.status}`);
    return (await res.json()) as { config: FluxyEmbedConfig; snippet: string };
  }

  async updateEmbedConfig(input: {
    enabled?: boolean;
    defaultRoomId?: string | null;
    allowedOrigins?: string[];
    zIndex?: number;
    launcherTitle?: string | null;
    theme?: Partial<FluxyEmbedTheme>;
    proactiveTriggers?: FluxyEmbedProactiveTrigger[];
  }): Promise<{ config: FluxyEmbedConfig; snippet: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/embed-config", this.baseUrl).toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateEmbedConfig failed: ${res.status}`);
    return (await res.json()) as { config: FluxyEmbedConfig; snippet: string };
  }

  async getPublicEmbedConfig(): Promise<FluxyPublicEmbedConfig | null> {
    const res = await fetch(new URL("/public/embed-config", this.baseUrl).toString());
    if (!res.ok) throw new Error(`getPublicEmbedConfig failed: ${res.status}`);
    return (await res.json()) as FluxyPublicEmbedConfig;
  }

  async resolveRoomHandoff(
    roomId: string,
    disposition: string,
  ): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ disposition }),
    });
    if (!res.ok) throw new Error(`resolveRoomHandoff failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  /**
   * Upload to Worker `POST /upload` (requires JWT). Returns attachment fields for composing a message.
   */
  async uploadFile(roomId: string, file: File): Promise<FluxyChatAttachment> {
    if (!this.token) {
      throw new Error("JWT is required for uploads");
    }
    const contentType = file.type || "application/octet-stream";
    const url = new URL("/upload", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${this.token}`,
        "X-File-Name": file.name.slice(0, 255),
        "X-Room-Id": roomId,
      },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      file?: { url?: string; name?: string; size?: number; contentType?: string };
    };
    const f = json.file;
    if (!f?.url) throw new Error("Invalid upload response");
    return {
      kind: inferAttachmentKind(contentType, file.name || f.name || ""),
      url: f.url,
      name: (f.name || file.name || "upload").slice(0, 255),
      sizeBytes: typeof f.size === "number" ? f.size : file.size,
      contentType,
    };
  }

  /**
   * Generate an image via Worker `POST /ai-images/generate` (requires JWT).
   * Returns attachment fields suitable for composing a chat message when successful.
   */
  async generateAiImage(
    roomId: string,
    prompt: string,
    options?: {
      size?: string;
      quality?: string;
      style?: string;
      model?: string;
      messageId?: number;
    },
  ): Promise<{
    ok: boolean;
    attachment?: FluxyChatAttachment;
    id?: string;
    revisedPrompt?: string;
    error?: string;
    details?: string;
  }> {
    if (!this.token) {
      throw new Error("JWT is required for image generation");
    }
    const url = new URL("/ai-images/generate", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        prompt,
        size: options?.size,
        quality: options?.quality,
        style: options?.style,
        model: options?.model,
        messageId: options?.messageId,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      details?: string;
      id?: string;
      imageUrl?: string;
      revisedPrompt?: string;
    };
    if (!res.ok || !json.ok || !json.imageUrl) {
      return {
        ok: false,
        error: json.error || `Image generation failed (${res.status})`,
        details: json.details,
      };
    }
    const imageUrl = json.imageUrl.startsWith("http")
      ? json.imageUrl
      : new URL(json.imageUrl, this.baseUrl).toString();
    return {
      ok: true,
      id: json.id,
      revisedPrompt: json.revisedPrompt,
      attachment: {
        kind: "image",
        url: imageUrl,
        name: `generated-${json.id?.slice(0, 8) || "image"}.png`,
        contentType: "image/png",
      },
    };
  }

  async editMessageRest(messageId: number, content: string): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`Failed to edit message: ${res.status}`);
    }
  }

  async deleteMessageRest(messageId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete message: ${res.status}`);
    }
  }

  async branchRoomFromMessageRest(
    roomId: string,
    fromMessageId: number,
    options?: { agentId?: string; agentIds?: string[] },
  ): Promise<{ deletedIds: number[] }> {
    if (!this.token) {
      throw new Error("branchRoomFromMessage requires authentication");
    }
    const url = new URL(`/rooms/${roomId}/branch`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        fromMessageId,
        agentId: options?.agentId,
        agentIds: options?.agentIds,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason = typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
      throw new Error(`Failed to branch room: ${reason}`);
    }
    const body = await res.json();
    return { deletedIds: Array.isArray(body.deletedIds) ? body.deletedIds : [] };
  }

  async replayCounterfactual(
    roomId: string,
    payload: {
      originalRunId: string;
      toolCallId: string;
      modifiedParams?: Record<string, unknown>;
      fromMessageId?: number | null;
      dryRun?: boolean;
      agentId?: string;
    },
  ): Promise<{
    ok: boolean;
    runId: string;
    branchId: string;
    dryRun: boolean;
    sideEffect?: boolean;
    costWarning?: string | null;
    run: Record<string, unknown>;
    original: Record<string, unknown>;
  }> {
    if (!this.token) throw new Error("replayCounterfactual requires authentication");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/counterfactual`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason = typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
      throw new Error(`Counterfactual replay failed: ${reason}`);
    }
    return res.json();
  }

  async listCounterfactualRuns(
    roomId: string,
    originalRunId: string,
  ): Promise<{ original: Record<string, unknown>; alternatives: Record<string, unknown>[] }> {
    if (!this.token) throw new Error("listCounterfactualRuns requires authentication");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/counterfactuals`, this.baseUrl);
    url.searchParams.set("originalRunId", originalRunId);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list counterfactual runs: ${res.status}`);
    return res.json();
  }

  async sendReactionRest(
    messageId: number,
    emoji: string,
    op: "add" | "remove" = "add"
  ): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}/reactions`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: op === "remove" ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update reaction: ${res.status}`);
    }
  }

  async listNotifications(options?: {
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<FluxyInAppNotification[]> {
    if (!this.token) return [];
    const url = new URL("/notifications", this.baseUrl);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    if (options?.unreadOnly) url.searchParams.set("unreadOnly", "1");
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list notifications: ${res.status}`);
    const body = await res.json();
    return body.notifications ?? [];
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(
      `/notifications/${notificationId}/read`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
  }

  async markAllNotificationsRead(): Promise<void> {
    if (!this.token) return;
    const url = new URL("/notifications/read-all", this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark notifications read: ${res.status}`);
  }

  async markReadRest(roomId: string, messageId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/read`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to mark read: ${res.status}`);
    }
  }

  async getRoomCatchUp(roomId: string): Promise<FluxyRoomCatchUp> {
    if (!this.token) {
      return { unreadCount: 0, lastReadMessageId: 0, firstUnreadMessageId: null };
    }
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/unread`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get room catch-up: ${res.status}`);
    }
    const body = await res.json();
    return {
      unreadCount: Number(body.unreadCount) || 0,
      lastReadMessageId: Number(body.lastReadMessageId) || 0,
      firstUnreadMessageId:
        body.firstUnreadMessageId != null ? Number(body.firstUnreadMessageId) : null,
    };
  }

  async getRoomCatchUpDigest(roomId: string): Promise<FluxyRoomCatchUp> {
    if (!this.token) {
      return { unreadCount: 0, lastReadMessageId: 0, firstUnreadMessageId: null };
    }
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/catch-up/digest`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get catch-up digest: ${res.status}`);
    }
    const body = await res.json();
    return {
      unreadCount: Number(body.unreadCount) || 0,
      lastReadMessageId: Number(body.lastReadMessageId) || 0,
      firstUnreadMessageId:
        body.firstUnreadMessageId != null ? Number(body.firstUnreadMessageId) : null,
      digest: typeof body.digest === "string" ? body.digest : null,
      highlights: Array.isArray(body.highlights) ? body.highlights : [],
      messageSampleCount: Number(body.messageSampleCount) || 0,
    };
  }

  async getRoomSentiment(roomId: string, days = 7): Promise<FluxyRoomSentiment | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/sentiment`,
      this.baseUrl,
    );
    url.searchParams.set("days", String(days));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get room sentiment: ${res.status}`);
    }
    const body = await res.json();
    if (!body?.ok) return null;
    return {
      roomId: String(body.roomId ?? roomId),
      days: Number(body.days) || days,
      aggregate: body.aggregate ?? {
        mood: "neutral",
        score: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0,
      },
      timeline: Array.isArray(body.timeline) ? body.timeline : [],
    };
  }

  async getRoomDraft(roomId: string): Promise<FluxyRoomMessageDraft | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/draft`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get room draft: ${res.status}`);
    }
    const body = await res.json();
    const draft = body.draft;
    if (!draft || typeof draft.content !== "string" || !draft.content.trim()) {
      return null;
    }
    return {
      content: draft.content,
      replyToId:
        draft.replyToId != null && draft.replyToId !== ""
          ? Number(draft.replyToId)
          : null,
      updatedAt: String(draft.updatedAt ?? ""),
    };
  }

  async getRoomHealth(roomId: string): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/health`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get room health: ${res.status}`);
    return res.json();
  }

  async pinMessage(
    roomId: string,
    messageId: number | null,
  ): Promise<{ ok: boolean; roomId: string; pinnedMessageId: number | null }> {
    if (!this.token) throw new Error("pinMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pin`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) throw new Error(`Failed to pin message: ${res.status}`);
    return res.json();
  }

  async terminateRoomConnection(
    roomId: string,
    socketId: string,
    reason?: string,
  ): Promise<{ ok: boolean; closed?: number; socketId?: string }> {
    if (!this.token) throw new Error("terminateRoomConnection requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/terminate-connection`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ socketId, reason }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Failed to terminate connection: ${res.status}`);
    return body;
  }

  async createPoll(
    roomId: string,
    poll: { question: string; options: string[]; allowMultiple?: boolean },
    opts?: { replyTo?: number | null; clientMessageId?: string },
  ): Promise<{ message: Record<string, unknown> }> {
    if (!this.token) throw new Error("createPoll requires JWT token");
    const res = await fetch(new URL("/messages", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        poll,
        replyTo: opts?.replyTo ?? undefined,
        clientMessageId: opts?.clientMessageId,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create poll: ${res.status}`);
    return res.json();
  }

  async votePoll(
    messageId: number,
    optionIndex: number,
  ): Promise<{ ok: boolean; poll: Record<string, unknown> }> {
    if (!this.token) throw new Error("votePoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/vote`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex }),
    });
    if (!res.ok) throw new Error(`Failed to vote: ${res.status}`);
    return res.json();
  }

  async getPoll(messageId: number): Promise<Record<string, unknown>> {
    if (!this.token) throw new Error("getPoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/poll`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get poll: ${res.status}`);
    const body = await res.json();
    return body.poll ?? body;
  }

  async closePoll(
    messageId: number,
  ): Promise<{ ok: boolean; poll: Record<string, unknown> }> {
    if (!this.token) throw new Error("closePoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/poll`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ closed: true }),
    });
    if (!res.ok) throw new Error(`Failed to close poll: ${res.status}`);
    return res.json();
  }

  async createDecision(
    roomId: string,
    decision: {
      content: string;
      requiredRoles?: Array<{ role: string; count: number }>;
      requiredAcks?: number;
      allowedRoles?: string[];
      ttlSeconds?: number;
    },
    opts?: { replyTo?: number | null; clientMessageId?: string },
  ): Promise<{ message: Record<string, unknown> }> {
    if (!this.token) throw new Error("createDecision requires JWT token");
    const res = await fetch(new URL("/messages", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        decision,
        replyTo: opts?.replyTo ?? undefined,
        clientMessageId: opts?.clientMessageId,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create decision: ${res.status}`);
    return res.json();
  }

  async ackDecision(
    messageId: number,
  ): Promise<{ ok: boolean; decision: Record<string, unknown> }> {
    if (!this.token) throw new Error("ackDecision requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/ack`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Failed to ack decision: ${res.status}`);
    return res.json();
  }

  async getDecision(messageId: number): Promise<Record<string, unknown>> {
    if (!this.token) throw new Error("getDecision requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/decision`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get decision: ${res.status}`);
    const body = await res.json();
    return body.decision ?? body;
  }

  async listRoomPins(
    roomId: string,
    opts?: { category?: string; limit?: number },
  ): Promise<{ ok: boolean; pins: Array<Record<string, unknown>>; count: number }> {
    if (!this.token) throw new Error("listRoomPins requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins`,
      this.baseUrl,
    );
    if (opts?.category) url.searchParams.set("category", opts.category);
    if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list pins: ${res.status}`);
    return res.json();
  }

  async pinRoomMessage(
    roomId: string,
    messageId: number,
    category?: string,
  ): Promise<{ ok: boolean; pin: Record<string, unknown> }> {
    if (!this.token) throw new Error("pinRoomMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, category }),
    });
    if (!res.ok) throw new Error(`Failed to pin message: ${res.status}`);
    return res.json();
  }

  async unpinRoomMessage(
    roomId: string,
    messageId: number,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unpinRoomMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins/${messageId}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unpin message: ${res.status}`);
    return res.json();
  }

  async listBreakouts(
    roomId: string,
  ): Promise<{ ok: boolean; breakouts: Array<Record<string, unknown>> }> {
    if (!this.token) throw new Error("listBreakouts requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list breakouts: ${res.status}`);
    return res.json();
  }

  async createBreakout(
    roomId: string,
    name: string,
  ): Promise<{ ok: boolean; breakout: Record<string, unknown> }> {
    if (!this.token) throw new Error("createBreakout requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create breakout: ${res.status}`);
    return res.json();
  }

  async closeBreakout(
    roomId: string,
    breakoutId: string,
  ): Promise<{ ok: boolean; closedAt?: string }> {
    if (!this.token) throw new Error("closeBreakout requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts/${encodeURIComponent(breakoutId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to close breakout: ${res.status}`);
    return res.json();
  }

  async reportMessage(
    roomId: string,
    messageId: number,
    reason?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("reportMessage requires JWT token");
    const res = await fetch(new URL("/reports", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, messageId, reason }),
    });
    if (!res.ok) throw new Error(`Failed to report message: ${res.status}`);
    return res.json();
  }

  async listBlocks(): Promise<{ userId: string; blockedAt: string }[]> {
    if (!this.token) throw new Error("listBlocks requires JWT token");
    const res = await fetch(new URL("/blocks", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list blocks: ${res.status}`);
    const body = await res.json();
    return body.blocks ?? [];
  }

  async blockUser(userId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("blockUser requires JWT token");
    const res = await fetch(new URL("/blocks", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(`Failed to block user: ${res.status}`);
    return res.json();
  }

  async unblockUser(userId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unblockUser requires JWT token");
    const url = new URL(
      `/blocks/${encodeURIComponent(userId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unblock user: ${res.status}`);
    return res.json();
  }

  async authorizeChannel(
    socketId: string,
    roomIdOrChannel: string,
    presenceInfo?: Record<string, unknown>,
  ): Promise<{ auth: string; channel_data?: string; roomId: string }> {
    if (!this.token) throw new Error("authorizeChannel requires JWT token");
    const isChannelName = roomIdOrChannel.includes("-room-");
    const res = await fetch(new URL("/auth/channel", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        socket_id: socketId,
        ...(isChannelName
          ? { channel_name: roomIdOrChannel }
          : { roomId: roomIdOrChannel }),
        presenceInfo,
      }),
    });
    if (!res.ok) throw new Error(`Channel auth failed: ${res.status}`);
    return res.json();
  }

  async translateMessage(
    messageId: number,
    targetLang: string,
    sourceLang?: string,
  ): Promise<{
    messageId: number;
    cached: boolean;
    translation: { targetLang: string; translatedText: string; sourceLang?: string };
  }> {
    if (!this.token) throw new Error("translateMessage requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/translate`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ targetLang, sourceLang }),
    });
    if (!res.ok) throw new Error(`Failed to translate message: ${res.status}`);
    return res.json();
  }

  async markMessageDelivered(messageId: number): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("markMessageDelivered requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/delivered`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark delivered: ${res.status}`);
    return res.json();
  }

  async getMessageDeliveries(messageId: number): Promise<{
    messageId: number;
    deliveries: { userId: string; status: string; updatedAt: string }[];
  }> {
    if (!this.token) throw new Error("getMessageDeliveries requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/deliveries`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get deliveries: ${res.status}`);
    return res.json();
  }

  async registerPushDevice(
    platform: "fcm" | "web",
    token: string,
  ): Promise<{ ok: boolean; id: string }> {
    if (!this.token) throw new Error("registerPushDevice requires JWT token");
    const res = await fetch(new URL("/push/devices", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ platform, token }),
    });
    if (!res.ok) throw new Error(`Failed to register push device: ${res.status}`);
    return res.json();
  }

  async unregisterPushDevice(deviceId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unregisterPushDevice requires JWT token");
    const url = new URL(
      `/push/devices/${encodeURIComponent(deviceId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unregister push device: ${res.status}`);
    return res.json();
  }

  // ---------- Web Push / VAPID (P10-ext, Pusher Beams gap) ----------

  /**
   * Fetch the VAPID public key (and subject) for the project. Required before
   * `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
   * The public key is not secret.
   */
  async getVapidPublicKey(
    projectId?: string,
  ): Promise<{ publicKey: string; subject: string }> {
    const url = new URL("/push/web/vapid-public-key", this.baseUrl);
    if (projectId) url.searchParams.set("projectId", projectId);
    const res = await fetch(url.toString(), {
      headers: { "X-Fluxy-Project-Id": projectId || "" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch VAPID public key: ${res.status} ${(body as { error?: string }).error || ""}`,
      );
    }
    return res.json();
  }

  /**
   * Register a browser `PushSubscription` against the current JWT user.
   * Pass the result of `await registration.pushManager.subscribe(...)`.
   */
  async registerWebPush(
    subscription: PushSubscription,
    options?: { userAgent?: string; projectId?: string },
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("registerWebPush requires JWT token");
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error("registerWebPush: invalid PushSubscription (missing endpoint/keys)");
    }
    const headers: Record<string, string> = {
      ...(this.authHeaders() as Record<string, string>),
      "Content-Type": "application/json",
    };
    if (options?.projectId) headers["X-Fluxy-Project-Id"] = options.projectId;
    const res = await fetch(new URL("/push/web/subscribe", this.baseUrl).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: options?.userAgent,
      }),
    });
    if (!res.ok) throw new Error(`Failed to register web push: ${res.status}`);
    return res.json();
  }

  async unregisterWebPush(
    identifier: string,
  ): Promise<{ ok: boolean; removed: number }> {
    if (!this.token) throw new Error("unregisterWebPush requires JWT token");
    const url = new URL(
      `/push/web/subscribe/${encodeURIComponent(identifier)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unregister web push: ${res.status}`);
    return res.json();
  }

  async listWebPushSubscriptions(): Promise<{
    subscriptions: Array<{
      id: string;
      endpointHost: string;
      endpointPreview: string;
      userAgent: string | null;
      createdAt: string;
      updatedAt: string;
      lastSentAt: string | null;
      failureCount: number;
    }>;
  }> {
    if (!this.token) throw new Error("listWebPushSubscriptions requires JWT token");
    const res = await fetch(new URL("/push/web/subscriptions", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list web push subscriptions: ${res.status}`);
    return res.json();
  }

  async listPushDevices(): Promise<{
    enabled: boolean;
    devices: { id: string; platform: string; tokenPreview: string }[];
  }> {
    if (!this.token) throw new Error("listPushDevices requires JWT token");
    const res = await fetch(new URL("/push/devices", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list push devices: ${res.status}`);
    return res.json();
  }

  /** CP-003: Report that a push notification was received on the client. */
  async acknowledgePushDelivery(input: {
    roomId?: string;
    messageId?: number;
    platform?: string;
    deliveryLogId?: string;
    clientMeta?: Record<string, unknown>;
  }): Promise<{ ok: boolean; id?: string }> {
    if (!this.token) throw new Error("acknowledgePushDelivery requires JWT token");
    const res = await fetch(new URL("/push/delivery-ack", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        ...(this.authHeaders() as Record<string, string>),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Failed to acknowledge push delivery: ${res.status}`);
    return res.json();
  }

  /** Sync Sent.dm contact + opt-out mirror (admin JWT). Requires project Sent API keys on worker. */
  async syncSentContact(
    e164: string,
    userId?: string,
  ): Promise<{ ok: boolean; contact?: { optOut?: boolean } }> {
    if (!this.token) throw new Error("syncSentContact requires JWT token");
    const res = await fetch(
      new URL("/integrations/sent/contacts/sync", this.baseUrl).toString(),
      {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ e164, userId }),
      },
    );
    if (!res.ok) throw new Error(`Failed to sync Sent contact: ${res.status}`);
    return res.json();
  }

  /** Request SMS OTP via Sent.dm (API key on request, not JWT). */
  static async requestSmsOtp(
    baseUrl: string,
    apiKey: string,
    userId: string,
    e164: string,
  ): Promise<{ ok: boolean; expiresAt?: string; ttlSeconds?: number }> {
    const res = await fetch(new URL("/auth/sms-otp/send", baseUrl).toString(), {
      method: "POST",
      headers: {
        "X-Fluxy-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, e164 }),
    });
    if (!res.ok) throw new Error(`SMS OTP request failed: ${res.status}`);
    return res.json();
  }

  /** Verify SMS OTP and receive JWT (API key on request). */
  static async verifySmsOtp(
    baseUrl: string,
    apiKey: string,
    userId: string,
    e164: string,
    code: string,
    roles?: string[],
  ): Promise<{ token: string; expiresIn: number; e164: string }> {
    const res = await fetch(new URL("/auth/sms-otp/verify", baseUrl).toString(), {
      method: "POST",
      headers: {
        "X-Fluxy-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, e164, code, roles }),
    });
    if (!res.ok) throw new Error(`SMS OTP verify failed: ${res.status}`);
    return res.json();
  }

  async getRoomComplianceExport(roomId: string): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/compliance-export`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to export compliance pack: ${res.status}`);
    return res.json();
  }

  /** Download room history as Markdown (P12-O). */
  async exportRoomMarkdown(
    roomId: string,
    options?: { from?: string; to?: string },
  ): Promise<Blob | null> {
    if (!this.token) return null;
    const url = new URL(
      `/export/rooms/${encodeURIComponent(roomId)}.markdown`,
      this.baseUrl,
    );
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`exportRoomMarkdown failed: ${res.status}`);
    return res.blob();
  }

  /** Download room history as PDF (P12-O). */
  async exportRoomPdf(
    roomId: string,
    options?: { from?: string; to?: string },
  ): Promise<Blob | null> {
    if (!this.token) return null;
    const url = new URL(`/export/rooms/${encodeURIComponent(roomId)}.pdf`, this.baseUrl);
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`exportRoomPdf failed: ${res.status}`);
    return res.blob();
  }

  async listScheduledMessages(roomId: string): Promise<Record<string, unknown>[]> {
    if (!this.token) return [];
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list scheduled messages: ${res.status}`);
    const body = await res.json();
    return body.scheduled ?? [];
  }

  async scheduleMessage(
    roomId: string,
    payload: { content: string; sendAt: string; replyTo?: number | null },
  ): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to schedule message: ${res.status}`);
    return res.json();
  }

  async cancelScheduledMessage(roomId: string, scheduleId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages/${scheduleId}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to cancel scheduled message: ${res.status}`);
  }

  // --- Live Streaming ---

  async listStreams(status?: string): Promise<Record<string, unknown>[]> {
    const url = new URL("/api/live/events", this.baseUrl);
    if (status) url.searchParams.set("status", status);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`listStreams failed: ${res.status}`);
    return res.json();
  }

  async getStream(eventId: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getStream failed: ${res.status}`);
    return res.json();
  }

  async createStream(body: { title: string; description?: string; category?: string; roomId?: string }): Promise<{ id: string }> {
    if (!this.token) throw new Error("createStream requires JWT token");
    const res = await fetch(new URL("/api/live/events", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createStream failed: ${res.status}`);
    return res.json();
  }

  async updateStream(eventId: string, body: Record<string, unknown>): Promise<void> {
    if (!this.token) throw new Error("updateStream requires JWT token");
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`updateStream failed: ${res.status}`);
  }

  async getViewerCount(eventId: string): Promise<number> {
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/viewer-count`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? data.viewerCount ?? 0;
  }

  async joinStream(eventId: string): Promise<void> {
    if (!this.token) return;
    await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/join`, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({}),
    });
  }

  async leaveStream(eventId: string): Promise<void> {
    if (!this.token) return;
    await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/leave`, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({}),
    });
  }

  async putRoomDraft(
    roomId: string,
    payload: { content: string; replyToId?: number | null },
  ): Promise<FluxyRoomMessageDraft | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/draft`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to save room draft: ${res.status}`);
    }
    const body = await res.json();
    const draft = body.draft;
    if (!draft || typeof draft.content !== "string" || !draft.content.trim()) {
      return null;
    }
    return {
      content: draft.content,
      replyToId:
        draft.replyToId != null && draft.replyToId !== ""
          ? Number(draft.replyToId)
          : null,
      updatedAt: String(draft.updatedAt ?? ""),
    };
  }

  async listAgents(): Promise<FluxyChatAgent[]> {
    if (!this.token) return [];
    const res = await fetch(new URL("/agents", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`);
    const body = await res.json();
    return body.agents ?? [];
  }

  async invokeAgentRest(
    agentId: string,
    roomId: string,
    content: string,
    options?: {
      replyTo?: number | null;
      stream?: boolean;
    }
  ): Promise<{
    run: {
      id: string;
      status: string;
      latencyMs?: number;
      inputTokens?: number;
      outputTokens?: number;
      estimatedCost?: number;
      iterations?: number;
      toolCalls?: FluxyChatToolCall[];
      createdAt: string;
    };
    message: FluxyChatMessage;
  }> {
    if (!this.token) throw new Error("invokeAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}/invoke`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        content,
        replyTo: options?.replyTo ?? null,
        stream: options?.stream !== false,
      }),
    });
    if (!res.ok) throw new Error(`Failed to invoke agent: ${res.status}`);
    return res.json();
  }

  async getAgentRuns(agentId: string, limit = 50): Promise<FluxyChatAgentRun[]> {
    if (!this.token) return [];
    const url = new URL(`/agents/${encodeURIComponent(agentId)}/runs`, this.baseUrl);
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch agent runs: ${res.status}`);
    const body = await res.json();
    return body.runs ?? [];
  }

  async getAgent(agentId: string): Promise<FluxyChatAgent | null> {
    if (!this.token) return null;
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get agent: ${res.status}`);
    const body = await res.json();
    return body.agent ?? null;
  }

  async createAgent(body: {
    name: string;
    handle?: string;
    provider?: string;
    model?: string;
    systemPrompt?: string;
    contextFetchUrl?: string;
    toolExecuteUrl?: string;
    toolsSchema?: unknown[];
    rateLimitRpm?: number;
  }): Promise<FluxyChatAgent> {
    if (!this.token) throw new Error("createAgent requires JWT token");
    const res = await fetch(new URL("/agents", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create agent: ${res.status}`);
    const data = await res.json();
    return data.agent;
  }

  async updateAgent(agentId: string, body: Record<string, unknown>): Promise<FluxyChatAgent> {
    if (!this.token) throw new Error("updateAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update agent: ${res.status}`);
    const data = await res.json();
    return data.agent;
  }

  async deleteAgent(agentId: string): Promise<void> {
    if (!this.token) throw new Error("deleteAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
  }

  async createRoom(body: {
    name: string;
    type: string;
    id?: string;
    members?: { userId: string; role: string }[];
  }): Promise<{ id: string; type: string; name: string; created_at: string }> {
    if (!this.token) throw new Error("createRoom requires JWT token");
    const res = await fetch(new URL("/rooms", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
    const data = await res.json();
    return data.room;
  }

  async updateRoom(roomId: string, body: { name?: string; type?: string }): Promise<void> {
    if (!this.token) throw new Error("updateRoom requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update room: ${res.status}`);
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.token) throw new Error("deleteRoom requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete room: ${res.status}`);
  }

  async addRoomMember(roomId: string, userId: string, role = "member"): Promise<void> {
    if (!this.token) throw new Error("addRoomMember requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/members`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) throw new Error(`Failed to add room member: ${res.status}`);
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    if (!this.token) throw new Error("removeRoomMember requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to remove room member: ${res.status}`);
  }

  async registerWebhook(body: {
    url: string;
    eventTypes: string[];
    secret?: string;
  }): Promise<{ id: string; projectId: string; url: string; secret?: string }> {
    if (!this.token) throw new Error("registerWebhook requires JWT token");
    const res = await fetch(new URL("/webhooks/register", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to register webhook: ${res.status}`);
    const data = await res.json();
    return data.webhook;
  }

  async updateWebhook(webhookId: string, body: { url?: string; eventTypes?: string[]; secret?: string }): Promise<void> {
    if (!this.token) throw new Error("updateWebhook requires JWT token");
    const url = new URL(`/webhooks/${encodeURIComponent(webhookId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update webhook: ${res.status}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    if (!this.token) throw new Error("deleteWebhook requires JWT token");
    const url = new URL(`/webhooks/${encodeURIComponent(webhookId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete webhook: ${res.status}`);
  }

  // ── FluxyTrack: Fleet & GPS Tracking ──

  async ingestGps(data: {
    vehicleId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    /** Fan-out `fleet.gps_update` on this room (defaults to `fleet:{projectId}`). */
    roomId?: string;
  }): Promise<{ ok: boolean; ts: number; geofenceEvents: Array<{ id: string; geofenceId: string; vehicleId: string; eventType: string }> }> {
    if (!this.token) throw new Error("ingestGps requires JWT token");
    const res = await fetch(new URL("/fleet/gps", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to ingest GPS: ${res.status}`);
    return res.json();
  }

  async getFleetPositions(): Promise<{ ok: boolean; vehicles: Array<{ id: string; name: string; plate: string | null; status: string; lat: number | null; lng: number | null; heading: number | null; speed: number | null; lastSeenAt: string | null }> }> {
    if (!this.token) throw new Error("getFleetPositions requires JWT token");
    const res = await fetch(new URL("/fleet/gps/current", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get fleet positions: ${res.status}`);
    return res.json();
  }

  async getGpsHistory(vehicleId: string, from?: number, to?: number): Promise<{ ok: boolean; points: Array<{ ts: number; lat: number; lng: number; speed: number | null; heading: number | null }> }> {
    if (!this.token) throw new Error("getGpsHistory requires JWT token");
    const url = new URL("/fleet/gps/history", this.baseUrl);
    url.searchParams.set("vehicleId", vehicleId);
    if (from) url.searchParams.set("from", String(from));
    if (to) url.searchParams.set("to", String(to));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get GPS history: ${res.status}`);
    return res.json();
  }

  async listFleetVehicles(): Promise<{ ok: boolean; vehicles: Array<{ id: string; name: string; plate: string | null; driverId: string | null; status: string; lat: number | null; lng: number | null; speed: number | null; lastSeenAt: string | null; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetVehicles requires JWT token");
    const res = await fetch(new URL("/fleet/vehicles", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list fleet vehicles: ${res.status}`);
    return res.json();
  }

  async createFleetVehicle(data: { name: string; plate?: string; driverId?: string }): Promise<{ ok: boolean; vehicle: { id: string; name: string; plate: string | null; driverId: string | null; status: string } }> {
    if (!this.token) throw new Error("createFleetVehicle requires JWT token");
    const res = await fetch(new URL("/fleet/vehicles", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet vehicle: ${res.status}`);
    return res.json();
  }

  async updateFleetVehicle(vehicleId: string, data: { name?: string; plate?: string; driverId?: string; status?: string }): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("updateFleetVehicle requires JWT token");
    const res = await fetch(new URL(`/fleet/vehicles/${encodeURIComponent(vehicleId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update fleet vehicle: ${res.status}`);
    return res.json();
  }

  async listFleetTrips(status?: string): Promise<{ ok: boolean; trips: Array<{ id: string; vehicleId: string; status: string; startedAt: string | null; completedAt: string | null; driverId: string | null; pickup: { lat: number; lng: number; address: string | null }; dropoff: { lat: number; lng: number; address: string | null }; distanceMeters: number | null; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetTrips requires JWT token");
    const url = new URL("/fleet/trips", this.baseUrl);
    if (status) url.searchParams.set("status", status);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list fleet trips: ${res.status}`);
    return res.json();
  }

  async createFleetTrip(data: { vehicleId: string; pickupLat: number; pickupLng: number; pickupAddress?: string; dropoffLat: number; dropoffLng: number; dropoffAddress?: string }): Promise<{ ok: boolean; trip: { id: string; vehicleId: string; status: string; distanceMeters: number } }> {
    if (!this.token) throw new Error("createFleetTrip requires JWT token");
    const res = await fetch(new URL("/fleet/trips", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet trip: ${res.status}`);
    return res.json();
  }

  async updateFleetTripStatus(tripId: string, status: "active" | "completed" | "cancelled"): Promise<{ ok: boolean; status: string }> {
    if (!this.token) throw new Error("updateFleetTripStatus requires JWT token");
    const res = await fetch(new URL(`/fleet/trips/${encodeURIComponent(tripId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to update fleet trip: ${res.status}`);
    return res.json();
  }

  async listFleetGeofences(): Promise<{ ok: boolean; geofences: Array<{ id: string; name: string; lat: number; lng: number; radiusMeters: number; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetGeofences requires JWT token");
    const res = await fetch(new URL("/fleet/geofences", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list fleet geofences: ${res.status}`);
    return res.json();
  }

  async createFleetGeofence(data: { name: string; lat: number; lng: number; radiusMeters?: number }): Promise<{ ok: boolean; geofence: { id: string; name: string; lat: number; lng: number; radiusMeters: number } }> {
    if (!this.token) throw new Error("createFleetGeofence requires JWT token");
    const res = await fetch(new URL("/fleet/geofences", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet geofence: ${res.status}`);
    return res.json();
  }

  // ── FluxyTrack: Delivery Dispatch ──

  async findNearestDrivers(lat: number, lng: number, limit?: number): Promise<{ ok: boolean; drivers: Array<{ id: string; name: string; plate: string | null; lat: number; lng: number; speed: number | null; lastSeenAt: string | null; distanceMeters: number }> }> {
    if (!this.token) throw new Error("findNearestDrivers requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/nearest", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ lat, lng, limit }),
    });
    if (!res.ok) throw new Error(`Failed to find nearest drivers: ${res.status}`);
    return res.json();
  }

  async matchDelivery(data: {
    pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number;
    pickupAddress?: string; dropoffAddress?: string;
  }): Promise<{ ok: boolean; trip: { id: string; vehicleId: string; status: string; distanceMeters: number }; driver: { id: string; name: string; plate: string | null; etaMinutes: number; distanceMeters: number } }> {
    if (!this.token) throw new Error("matchDelivery requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/match", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to match delivery: ${res.status}`);
    return res.json();
  }

  async routeCopilot(data: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }): Promise<{
    ok: boolean; copilot: { distanceMeters: number; baseDurationMin: number; trafficFactor: number; weather: string; weatherFactor: number; estimatedDurationMin: number; alternatives: Array<{ label: string; durationMin: number; traffic: string; note: string | null }>; advice: string; timestamp: string }
  }> {
    if (!this.token) throw new Error("routeCopilot requires JWT token");
    const res = await fetch(new URL("/fleet/route/copilot", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to get route copilot: ${res.status}`);
    return res.json();
  }

  async predictDeliveryWindow(data: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }): Promise<{
    ok: boolean; window: { distanceKm: number; estimatedMinutes: number; windowLowMinutes: number; windowHighMinutes: number; windowLow: string; windowHigh: string; confidencePercent: number; sampleSize: number; factors: { peakHour: boolean; averageSpeedKmph: number } }
  }> {
    if (!this.token) throw new Error("predictDeliveryWindow requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/predict", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to predict delivery window: ${res.status}`);
    return res.json();
  }

  async getDynamicPricing(): Promise<{
    ok: boolean; pricing: { basePrice: number; surgeMultiplier: number; surgePrice: number; surgeLabel: string; activeTrips: number; availableDrivers: number; demandRatio: number; currency: string }
  }> {
    if (!this.token) throw new Error("getDynamicPricing requires JWT token");
    const res = await fetch(new URL("/fleet/pricing", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
    });
    if (!res.ok) throw new Error(`Failed to get dynamic pricing: ${res.status}`);
    return res.json();
  }
}
