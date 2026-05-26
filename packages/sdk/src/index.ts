export {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
  FLUXY_WS_CLOSE_NORMAL,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from "./errors";

export {
  FluxyChatRoomConnection,
  type FluxyRoomConnectionOptions,
  type FluxyRoomConnectionStatus,
  type FluxyWaitForOptions,
} from "./room-connection";

export { FluxyMessageStream, type FluxyMessageStreamOptions } from "./message-stream";

export {
  clampHistoryLimit,
  mergeMessagesChronological,
  sortMessagesChronological,
  MAX_HISTORY_LIMIT,
  type HistoryMessage,
} from "./message-history";

export { decodeFluxyJwtPayload, jwtRefreshDelayMs, type DecodedFluxyJwt } from "./jwt-utils";

export {
  FLUXY_MAX_MESSAGE_LENGTH,
  normalizeRoomMember,
  normalizeRoomMembers,
} from "./room-rest";

export {
  validateAgentOutboundMessage,
  buildAgentOutboundWsPayload,
  type AgentOutboundMessageInput,
  type AgentOutboundValidationResult,
} from "./agent-outbound";

export {
  FluxyRealtimeProvider,
  type FluxyRealtimeProviderProps,
  type FluxyAuthTokenResult,
} from "./realtime-provider";

export { useFluxyChat, useFluxyChatOptional, type FluxyRealtimeContextValue } from "./use-fluxy-chat";

export {
  useChat,
  type UseChatOptions,
  type UseChatHistoryReplay,
} from "./use-chat";

export {
  createFluxyRoomStore,
  syncRoomConnectionState,
  type FluxyRoomStore,
  type FluxyRoomStoreState,
  type FluxyUseChatConnectionStatus,
  type FluxyToolThreadEvent,
} from "./fluxy-room-store";

export {
  createFluxyRoomSession,
  startFluxyRoomSession,
  type StartFluxyRoomSessionOptions,
} from "./room-session";

export { useFluxyRoomStore, useFluxyRoomStoreState } from "./use-fluxy-room-store";

export {
  renderMessageTemplate,
  extractTemplateVarNames,
  type FluxyMessageTemplate,
  type FluxySendMessageOptions,
  type FluxyProjectActivity,
} from "./message-template";

export {
  buildFluxyConnectionState,
  type FluxyChatTransport,
  type FluxyConnectionState,
  type FluxyConnectionStateStatus,
} from "./connection-state";

export {
  applyServerMessageAck,
  createClientMessageId,
  createOptimisticMessage,
  markMessageDeliveryFailed,
  tryMatchPendingByInbound,
  type FluxyChatMessageWithDelivery,
  type FluxyDeliverableMessage,
  type FluxyMessageDeliveryFields,
  type FluxyMessageDeliveryStatus,
} from "./message-delivery";

export { useRooms } from "./use-rooms";

import { FluxyChatRoomConnection, type FluxyRoomConnectionOptions } from "./room-connection";
import { FluxyAuthError, FluxySendError } from "./errors";
import { clampHistoryLimit, sortMessagesChronological } from "./message-history";
import { normalizeRoomMembers } from "./room-rest";
import { trimTrailingSlashes } from "./url-utils";

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
  };
  attachments?: FluxyChatAttachment[];
  /** True while an agent (or user) is still streaming tokens into this message. */
  streaming?: boolean;
  /** Client-only id for optimistic send dedupe (not stored server-side yet). */
  clientMessageId?: string;
  /** Client-only delivery state for optimistic UI. */
  deliveryStatus?: "pending" | "sent" | "failed";
  deliveryError?: string;
}

export interface FluxyChatAttachment {
  id?: number;
  kind: string; // 'image' | 'file' | 'audio' | etc.
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
  /** ISO `createdAt` cursor â€” returns messages older than this timestamp. */
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
export type FluxyChatEvent =
  | { type: "history"; messages: FluxyChatMessage[] }
  | ({ type: "message" } & FluxyChatMessage)
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
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "agentTyping"; agentId: string; isTyping: boolean }
  | {
      type: "tool_call";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      arguments?: string;
    }
  | {
      type: "tool_result";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      result?: unknown;
    }
  | {
      type: "tool_error";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      error?: string;
    }
  | { type: "agentRun"; run: FluxyChatAgentRun }
  | { type: "presence"; online: number; users?: string[] }
  | { type: "error"; message: string };

export interface FluxyChatClientOptions {
  baseUrl: string;
  userId: string;
  apiKey?: string;
  /**
   * Optional JWT for authenticated REST calls (POST /messages, reactions, read, reports, etc).
   * When provided, the SDK will prefer REST for writes and use WebSocket mainly for realtime updates.
   */
  token?: string;
}

export class FluxyChatClient {
  private baseUrl: string;
  readonly userId: string;
  readonly apiKey?: string;
   readonly token?: string;

  constructor(options: FluxyChatClientOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl);
    this.userId = options.userId;
    this.apiKey = options.apiKey;
    this.token = options.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
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

  connect(roomId: string): WebSocket {
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
    const ws = new WebSocket(url.toString());
    return ws;
  }

  /**
   * Resilient room WebSocket with typed errors, exponential backoff reconnect,
   * and optional REST history replay after reconnect.
   */
  connectRoom(roomId: string, options?: FluxyRoomConnectionOptions): FluxyChatRoomConnection {
    return new FluxyChatRoomConnection(this, roomId, options);
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
    return sortMessagesChronological((body.messages ?? []) as FluxyChatMessage[]);
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

  /** Alias for {@link fetchMessages} — chronological room history via REST. */
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
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create message: ${res.status}`);
    }
    const body = await res.json();
    return body.message ?? null;
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
}
