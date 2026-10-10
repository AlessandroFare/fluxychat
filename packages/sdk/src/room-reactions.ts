import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";

export type FluxyRoomReactionFrame = Extract<FluxyChatEvent, { type: "room_reaction" }>;

export interface FluxyRoomReaction {
  name: string;
  userId: string;
  ts?: number;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** Ably `RoomReactionEvent`. */
export interface FluxyRoomReactionEvent {
  type: "reaction";
  reaction: FluxyRoomReaction;
}

export interface FluxySendRoomReactionParams {
  name: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface FluxyRoomReactions {
  send(name: string | FluxySendRoomReactionParams): void;
  subscribe(handler: (event: FluxyRoomReactionEvent) => void): FluxySubscription;
}

export function roomReactionEventFromWire(event: FluxyRoomReactionFrame): FluxyRoomReactionEvent {
  return {
    type: "reaction",
    reaction: {
      name: event.name,
      userId: event.userId,
      ...(event.ts != null ? { ts: event.ts } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      ...(event.headers ? { headers: event.headers } : {}),
    },
  };
}

export function bindRoomReactions(connection: FluxyChatRoomConnection): FluxyRoomReactions {
  return {
    send(name) {
      const params = typeof name === "string" ? { name } : name;
      const extras = {
        ...(params.metadata ? { metadata: params.metadata } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      };
      connection.sendRoomReaction(
        params.name,
        Object.keys(extras).length ? extras : undefined,
      );
    },
    subscribe(handler) {
      return fluxySubscription(
        connection.onRoomReaction((event) => handler(roomReactionEventFromWire(event))),
      );
    },
  };
}
