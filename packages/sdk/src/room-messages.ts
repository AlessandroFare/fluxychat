import type { FluxyChatEvent, FluxyChatMessage } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import {
  fetchMessageHistoryPage,
  singlePageResult,
  type FluxyHistoryParams,
  type FluxyPaginatedResult,
} from "./paginated-messages";
import {
  applyRawReaction,
  type FluxyMessageReactionSummary,
} from "./reaction-summary";
import { FluxyErrorInfo, unableTo } from "./errors";
import { fluxySubscription } from "./fluxy-subscription";
import {
  copyChatMessage,
  stampMessageText,
  withChatMessage,
  type FluxyMessageCopyParams,
} from "./message-with";

const MESSAGE_EVENT_TYPES = new Set([
  "message",
  "edit",
  "message_updated",
  "delete",
  "message_delete",
  "message_deleted",
]);

/** Ably `ChatMessageEventType`. */
export type FluxyChatMessageEventType =
  | "message.created"
  | "message.updated"
  | "message.deleted";

export interface FluxyChatMessageEvent {
  type: FluxyChatMessageEventType;
  message: FluxyChatMessage;
}

export type FluxyRoomMessageEvent = FluxyChatMessageEvent;

function chatMessageEventType(wireType: string): FluxyChatMessageEventType | null {
  if (wireType === "message") return "message.created";
  if (wireType === "edit" || wireType === "message_updated") return "message.updated";
  if (
    wireType === "delete" ||
    wireType === "message_delete" ||
    wireType === "message_deleted"
  ) {
    return "message.deleted";
  }
  return null;
}

export function chatMessageEventFromWire(event: FluxyChatEvent): FluxyChatMessageEvent | null {
  const type = chatMessageEventType(event.type);
  if (!type || !MESSAGE_EVENT_TYPES.has(event.type)) return null;
  const row = event as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  const createdAt = String(row.createdAt ?? row.editedAt ?? row.deletedAt ?? "");
  const { type: _wire, ...rest } = row;
  return {
    type,
    message: stampMessageText({
      ...rest,
      id,
      serial: String(row.serial ?? id),
      roomId: String(row.roomId ?? ""),
      userId: String(row.userId ?? ""),
      content: String(row.content ?? ""),
      createdAt,
    } as FluxyChatMessage),
  };
}

export type FluxyRoomMessageReactionWire = Extract<FluxyChatEvent, { type: "reaction" }>;

export type FluxyMessageReactionRawEventType = "reaction.create" | "reaction.delete";

export interface FluxyMessageReactionRawEvent {
  type: FluxyMessageReactionRawEventType;
  reaction: {
    messageSerial: string;
    name: string;
    clientId: string;
    type: "distinct";
  };
}

export interface FluxyMessageReactionSummaryEvent {
  type: "reaction.summary";
  messageSerial: string;
  reactions: FluxyMessageReactionSummary;
}

export type FluxyRoomMessageReactionEvent = FluxyMessageReactionRawEvent;

export interface FluxyMessageSubscription {
  (): void;
  unsubscribe(): void;
  off(): void;
  historyBeforeSubscribe(
    params?: Omit<FluxyHistoryParams, "orderBy">,
  ): Promise<FluxyPaginatedResult<FluxyChatMessage>>;
}

export interface FluxySendMessageParams {
  text: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Same field as REST `replyTo` / `parentId`. */
  replyTo?: number | null;
  quotedMessageId?: number | null;
}

export interface FluxyUpdateMessageParams {
  text: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** Ably `OperationDetails` on update/delete. */
export interface FluxyOperationDetails {
  description?: string;
  metadata?: Record<string, unknown>;
}

export type FluxyMessageReactionType = "unique" | "distinct" | "multiple";

export interface FluxySendMessageReactionParams {
  name: string;
  type?: FluxyMessageReactionType;
  count?: number;
}

export interface FluxyDeleteMessageReactionParams {
  name?: string;
  type?: FluxyMessageReactionType;
}

export interface FluxyClientReactions {
  userId: string;
  names: string[];
  unique: FluxyMessageReactionSummary["unique"];
  distinct: FluxyMessageReactionSummary["distinct"];
  multiple: FluxyMessageReactionSummary["multiple"];
}

export interface FluxyRoomMessageReactions {
  send(
    messageId: number | string,
    nameOrParams: string | FluxySendMessageReactionParams,
  ): Promise<void>;
  delete(
    messageId: number | string,
    nameOrParams?: string | FluxyDeleteMessageReactionParams,
  ): Promise<void>;
  get(messageId: number): Promise<FluxyMessageReactionSummary>;
  subscribe(handler: (event: FluxyMessageReactionSummaryEvent) => void): () => void;
  subscribeRaw(handler: (event: FluxyMessageReactionRawEvent) => void): () => void;
  clientReactions(messageId: number, userId?: string): Promise<FluxyClientReactions>;
}

export interface FluxyRoomMessages {
  send(content: string | FluxySendMessageParams): Promise<FluxyChatMessage | null>;
  get(messageId: number | string): Promise<FluxyChatMessage>;
  getVersions(messageId: number | string): Promise<FluxyPaginatedResult<FluxyChatMessage>>;
  update(
    messageId: number,
    content: string | FluxyUpdateMessageParams,
    details?: FluxyOperationDetails,
  ): Promise<FluxyChatMessage | null>;
  delete(messageId: number, details?: FluxyOperationDetails): Promise<FluxyChatMessage | null>;
  history(params?: FluxyHistoryParams): Promise<FluxyPaginatedResult<FluxyChatMessage>>;
  subscribe(
    typesOrHandler:
      | FluxyChatMessageEventType
      | FluxyChatMessageEventType[]
      | ((event: FluxyRoomMessageEvent) => void),
    handler?: (event: FluxyRoomMessageEvent) => void,
  ): FluxyMessageSubscription;
  with(
    message: FluxyChatMessage,
    event: FluxyChatMessageEvent | FluxyMessageReactionSummaryEvent | FluxyChatMessage,
  ): FluxyChatMessage;
  copy(message: FluxyChatMessage, params?: FluxyMessageCopyParams): FluxyChatMessage;
  reactions: FluxyRoomMessageReactions;
}

export function rawReactionEventFromWire(
  event: FluxyChatEvent,
): FluxyMessageReactionRawEvent | null {
  if (event.type !== "reaction") return null;
  return {
    type: event.op === "remove" ? "reaction.delete" : "reaction.create",
    reaction: {
      messageSerial: String(event.messageId),
      name: event.emoji,
      clientId: event.userId,
      type: "distinct",
    },
  };
}

function subscribeReactions(
  connection: FluxyChatRoomConnection,
  handler: (event: FluxyMessageReactionRawEvent) => void,
): () => void {
  const listener = (event: FluxyChatEvent) => {
    const mapped = rawReactionEventFromWire(event);
    if (mapped) handler(mapped);
  };
  connection.onAnyEvent(listener);
  return () => connection.offAnyEvent(listener);
}

function parseMessageId(messageId: number | string): number {
  const id = typeof messageId === "number" ? messageId : Number(String(messageId).trim());
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("unable to get message; invalid id");
  }
  return Math.floor(id);
}

export function bindRoomMessages(connection: FluxyChatRoomConnection): FluxyRoomMessages {
  return {
    send(content) {
      const text = typeof content === "string" ? content : content.text;
      const extras =
        typeof content === "string"
          ? undefined
          : {
              ...(content.metadata ? { metadata: content.metadata } : {}),
              ...(content.headers ? { headers: content.headers } : {}),
              ...(content.replyTo != null ? { replyTo: content.replyTo } : {}),
              ...(content.quotedMessageId != null ? { quotedMessageId: content.quotedMessageId } : {}),
            };
      return connection.sendMessageText(text, extras);
    },
    get(messageId) {
      return connection.getMessageById(parseMessageId(messageId));
    },
    async getVersions(messageId) {
      const items = await connection.getMessageVersions(parseMessageId(messageId));
      return singlePageResult(items);
    },
    update(messageId, content, details) {
      const text = typeof content === "string" ? content : content.text;
      const extras = {
        ...(typeof content === "string"
          ? {}
          : {
              ...(content.metadata ? { metadata: content.metadata } : {}),
              ...(content.headers ? { headers: content.headers } : {}),
            }),
        ...(details?.description ? { description: details.description } : {}),
        ...(details?.metadata ? { operationMetadata: details.metadata } : {}),
      };
      return connection.editMessageText(
        messageId,
        text,
        Object.keys(extras).length ? extras : undefined,
      );
    },
    delete(messageId, details) {
      return connection.deleteMessage(messageId, details);
    },
    reactions: {
      send(messageId, nameOrParams) {
        const params =
          typeof nameOrParams === "string" ? { name: nameOrParams } : nameOrParams;
        const type = params.type ?? connection.defaultMessageReactionType ?? "distinct";
        return connection.sendMessageReaction(parseMessageId(messageId), params.name, "add", {
          type,
          ...(params.count != null ? { count: params.count } : {}),
        });
      },
      delete(messageId, nameOrParams) {
        const params =
          typeof nameOrParams === "string"
            ? { name: nameOrParams }
            : nameOrParams ?? {};
        const type = params.type ?? connection.defaultMessageReactionType ?? "distinct";
        if (type !== "unique" && !params.name) {
          throw new Error(unableTo("delete reaction", "name required for distinct/multiple"));
        }
        return connection.sendMessageReaction(parseMessageId(messageId), params.name ?? "", "remove", {
          type,
        });
      },
      get(messageId) {
        return connection.getReactionSummary(messageId);
      },
      subscribe(handler) {
        const summaries = new Map<number, FluxyMessageReactionSummary>();
        const listener = (event: FluxyChatEvent) => {
          if (event.type !== "reaction") return;
          handler({
            type: "reaction.summary",
            messageSerial: String(event.messageId),
            reactions: applyRawReaction(summaries, event),
          });
        };
        connection.onAnyEvent(listener);
        return () => connection.offAnyEvent(listener);
      },
      subscribeRaw(handler) {
        if (connection.rawMessageReactionsEnabled !== true) {
          throw new FluxyErrorInfo({
            identifier: "feature_not_enabled",
            operation: "subscribe raw reactions",
            reason: "raw message reactions are disabled for this room",
          });
        }
        return subscribeReactions(connection, handler);
      },
      clientReactions(messageId, userId) {
        return connection.getClientReactions(messageId, userId);
      },
    },
    history(params) {
      return fetchMessageHistoryPage((options) => connection.fetchHistory(options), params);
    },
    with(message, event) {
      return withChatMessage(message, event);
    },
    copy(message, params) {
      return copyChatMessage(message, params);
    },
    subscribe(typesOrHandler, handler) {
      const listenerFn =
        typeof typesOrHandler === "function" ? typesOrHandler : handler;
      if (!listenerFn) {
        throw new Error(unableTo("subscribe messages", "listener required"));
      }
      const types =
        typeof typesOrHandler === "function"
          ? null
          : new Set(Array.isArray(typesOrHandler) ? typesOrHandler : [typesOrHandler]);
      const listener = (event: FluxyChatEvent) => {
        const mapped = chatMessageEventFromWire(event);
        if (!mapped) return;
        if (types && !types.has(mapped.type)) return;
        listenerFn(mapped);
      };
      connection.onAnyEvent(listener);
      const sub = fluxySubscription(() => connection.offAnyEvent(listener)) as FluxyMessageSubscription;
      sub.historyBeforeSubscribe = (params) =>
        fetchMessageHistoryPage((options) => connection.fetchHistory(options), {
          ...params,
          orderBy: "newestFirst",
        });
      return sub;
    },
  };
}
