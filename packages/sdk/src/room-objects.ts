import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";

/** Room JSON bag (`derived` / `derived_set`). LiveObjects-shaped, our wire. */
export interface FluxyRoomObjects {
  get(): Record<string, unknown>;
  set(state: Record<string, unknown>): void;
  subscribe(handler: (state: Record<string, unknown>) => void): () => void;
}

export function bindRoomObjects(connection: FluxyChatRoomConnection): FluxyRoomObjects {
  return {
    get() {
      return connection.derivedCurrent;
    },
    set(state) {
      connection.sendDerivedSet(state);
    },
    subscribe(handler) {
      const listener = (event: FluxyChatEvent) => {
        if (event.type === "derived") handler(event.state);
      };
      connection.onAnyEvent(listener);
      return () => connection.offAnyEvent(listener);
    },
  };
}
