import { sortMessagesChronological } from "./message-history";

/** Minimal message shape for delivery helpers (matches {@link FluxyChatMessage}). */
export interface FluxyDeliverableMessage {
  id: number;
  roomId: string;
  userId: string;
  senderId?: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  attachments?: Array<{
    id?: number;
    kind: string;
    url: string;
    name: string;
    sizeBytes?: number;
    contentType?: string;
  }>;
  streaming?: boolean;
}

export type FluxyMessageDeliveryStatus = "pending" | "sent" | "failed";

/** Message fields used for optimistic UI (client-only until server ack). */
export interface FluxyMessageDeliveryFields {
  /** Stable client id for dedupe / retry (not persisted by Worker today). */
  clientMessageId?: string;
  deliveryStatus?: FluxyMessageDeliveryStatus;
  deliveryError?: string;
}

export type FluxyChatMessageWithDelivery = FluxyDeliverableMessage & FluxyMessageDeliveryFields;

let optimisticIdCounter = 0;

export function createClientMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cmsg_${crypto.randomUUID()}`;
  }
  return `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function nextOptimisticMessageId(): number {
  optimisticIdCounter -= 1;
  return optimisticIdCounter;
}

export interface CreateOptimisticMessageInput {
  roomId: string;
  userId: string;
  content: string;
  clientMessageId: string;
  parentId?: number | null;
  attachments?: FluxyDeliverableMessage["attachments"];
}

export function createOptimisticMessage(
  input: CreateOptimisticMessageInput,
): FluxyChatMessageWithDelivery {
  return {
    id: nextOptimisticMessageId(),
    roomId: input.roomId,
    userId: input.userId,
    content: input.content,
    createdAt: new Date().toISOString(),
    parentId: input.parentId ?? null,
    attachments: input.attachments,
    clientMessageId: input.clientMessageId,
    deliveryStatus: "pending",
  };
}

export function applyServerMessageAck(
  messages: FluxyChatMessageWithDelivery[],
  serverMessage: FluxyDeliverableMessage,
  clientMessageId: string,
): FluxyChatMessageWithDelivery[] {
  const withoutPending = messages.filter((m) => m.clientMessageId !== clientMessageId);
  const acked: FluxyChatMessageWithDelivery = {
    ...serverMessage,
    clientMessageId,
    deliveryStatus: "sent",
    deliveryError: undefined,
  };
  return sortMessagesChronological([...withoutPending, acked]);
}

export function markMessageDeliveryFailed(
  messages: FluxyChatMessageWithDelivery[],
  clientMessageId: string,
  errorMessage: string,
): FluxyChatMessageWithDelivery[] {
  return messages.map((m) =>
    m.clientMessageId === clientMessageId
      ? {
          ...m,
          deliveryStatus: "failed" as const,
          deliveryError: errorMessage,
        }
      : m,
  );
}

/** Match an inbound WS/REST message to a pending optimistic row (same author). */
export function tryMatchPendingByInbound(
  messages: FluxyChatMessageWithDelivery[],
  inbound: FluxyDeliverableMessage,
  senderUserId: string,
): FluxyChatMessageWithDelivery[] {
  if (inbound.userId !== senderUserId && inbound.senderId !== senderUserId) {
    return messages;
  }

  const pendingIdx = messages.findIndex(
    (m) =>
      m.deliveryStatus === "pending" &&
      m.userId === senderUserId &&
      m.content === inbound.content &&
      (m.parentId ?? null) === (inbound.parentId ?? null),
  );
  if (pendingIdx < 0) return messages;

  const pending = messages[pendingIdx];
  const clientMessageId = pending.clientMessageId;
  const next = [...messages];
  next[pendingIdx] = {
    ...inbound,
    clientMessageId,
    deliveryStatus: "sent",
    deliveryError: undefined,
  };
  return sortMessagesChronological(next);
}
