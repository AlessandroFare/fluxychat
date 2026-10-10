import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import { parsePresencePatchEvent, type FluxyUiLocation } from "./presence-patch";

export interface FluxyLocationChange {
  userId: string;
  member: { userId: string };
  current: FluxyUiLocation | null;
  previous: FluxyUiLocation | null;
  /** Spaces `LocationsEvents.UpdateEvent.currentLocation`. */
  currentLocation: FluxyUiLocation | null;
  /** Spaces `LocationsEvents.UpdateEvent.previousLocation`. */
  previousLocation: FluxyUiLocation | null;
}

export interface FluxyRoomLocations {
  set(location: FluxyUiLocation): void;
  getSelf(): Promise<FluxyUiLocation | null>;
  getOthers(): Promise<Record<string, FluxyUiLocation | null>>;
  getAll(): Promise<Record<string, FluxyUiLocation | null>>;
  subscribe(handler: (change: FluxyLocationChange) => void): () => void;
}

export function bindRoomLocations(connection: FluxyChatRoomConnection): FluxyRoomLocations {
  const last = new Map<string, FluxyUiLocation | null>();
  return {
    set(location) {
      last.set(connection.userId, location);
      connection.sendPresencePatch({ uiLocation: location });
    },
    async getAll() {
      return Object.fromEntries(last);
    },
    async getSelf() {
      return last.get(connection.userId) ?? null;
    },
    async getOthers() {
      const all = Object.fromEntries(last);
      delete all[connection.userId];
      return all;
    },
    subscribe(handler) {
      const listener = (event: FluxyChatEvent) => {
        if (event.type !== "presence_patch") return;
        const userId = String(event.userId || "").trim();
        if (!userId) return;
        const patch = parsePresencePatchEvent(event);
        if (!patch || !("uiLocation" in patch)) return;
        const current = patch.uiLocation ?? null;
        const previous = last.get(userId) ?? null;
        last.set(userId, current);
        handler({
          userId,
          member: { userId },
          current,
          previous,
          currentLocation: current,
          previousLocation: previous,
        });
      };
      connection.onAnyEvent(listener);
      return () => connection.offAnyEvent(listener);
    },
  };
}
