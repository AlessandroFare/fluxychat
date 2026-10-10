import { unableTo } from "./errors";
import type { FluxyChatMessage } from "./fluxy-chat-client";
import type { FluxyChatMessageEvent, FluxyMessageReactionSummaryEvent } from "./room-messages";

export interface FluxyMessageCopyParams {
  text?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

function serialOf(message: FluxyChatMessage): string {
  return message.serial ?? String(message.id);
}

export function messageVersionSerial(message: FluxyChatMessage): string {
  if (message.version?.serial) return message.version.serial;
  const at = message.editedAt || message.deletedAt || message.createdAt || "";
  return `${serialOf(message)}:${at}`;
}

export function stampMessageText(message: FluxyChatMessage): FluxyChatMessage {
  const serial = serialOf(message);
  const timestamp = message.editedAt || message.deletedAt || message.createdAt || "";
  const versionSerial = message.version?.serial ?? `${serial}:${timestamp}`;
  return {
    ...message,
    serial,
    clientId: message.clientId ?? message.userId,
    content: message.content,
    text: message.text ?? message.content,
    version: {
      serial: versionSerial,
      timestamp,
      clientId: message.version?.clientId ?? message.userId,
      ...(message.version?.description ? { description: message.version.description } : {}),
    },
  };
}

function comparableVersion(message: FluxyChatMessage): string | null {
  if (message.version?.serial) return message.version.serial;
  if (message.editedAt || message.deletedAt) {
    return `${serialOf(message)}:${message.editedAt || message.deletedAt}`;
  }
  return null;
}

function isOlderOrSameVersion(current: FluxyChatMessage, incoming: FluxyChatMessage): boolean {
  const incomingVersion = comparableVersion(incoming);
  if (!incomingVersion) return false;
  return messageVersionSerial(current) >= incomingVersion;
}

/** Ably `Message.with`: apply an update/delete or reaction summary to a message. */
export function withChatMessage(
  message: FluxyChatMessage,
  event: FluxyChatMessageEvent | FluxyMessageReactionSummaryEvent | FluxyChatMessage,
): FluxyChatMessage {
  if ("id" in event && !("type" in event)) {
    const next = event as FluxyChatMessage;
    if (serialOf(next) !== serialOf(message)) {
      throw new Error(unableTo("apply message event", "event is for a different message"));
    }
    if (isOlderOrSameVersion(message, next)) return message;
    return stampMessageText({ ...message, ...next, id: message.id, serial: serialOf(message) });
  }
  const typed = event as FluxyChatMessageEvent | FluxyMessageReactionSummaryEvent;
  if (typed.type === "message.created") {
    throw new Error(unableTo("apply message event", "unable to apply created event to existing message"));
  }
  if (typed.type === "reaction.summary") {
    if (typed.messageSerial !== serialOf(message)) {
      throw new Error(unableTo("apply message event", "event is for a different message"));
    }
    return stampMessageText({
      ...message,
      reactions: Object.fromEntries(
        Object.entries(typed.reactions.distinct).map(([name, row]) => [name, row.total]),
      ),
    });
  }
  if (typed.message && serialOf(typed.message) !== serialOf(message) && typed.message.id !== message.id) {
    throw new Error(unableTo("apply message event", "event is for a different message"));
  }
  if (typed.type === "message.updated") {
    if (isOlderOrSameVersion(message, typed.message)) return message;
    return stampMessageText({
      ...message,
      ...typed.message,
      id: message.id,
      serial: serialOf(message),
      content: typed.message.content ?? message.content,
    });
  }
  if (typed.type === "message.deleted") {
    if (isOlderOrSameVersion(message, typed.message)) return message;
    return stampMessageText({
      ...message,
      ...typed.message,
      id: message.id,
      serial: serialOf(message),
      deletedAt: typed.message.deletedAt ?? typed.message.createdAt ?? message.deletedAt,
    });
  }
  return message;
}

/** Ably `Message.copy`. */
export function copyChatMessage(
  message: FluxyChatMessage,
  params: FluxyMessageCopyParams = {},
): FluxyChatMessage {
  const content = params.text ?? params.content ?? message.content;
  return stampMessageText({
    ...message,
    content,
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(params.headers ? { headers: params.headers } : {}),
  });
}
