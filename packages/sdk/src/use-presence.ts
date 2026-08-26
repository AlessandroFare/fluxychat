"use client";

import React from "react";
import type { FluxyRoomStore } from "./fluxy-room-store";
import { useFluxyRoomStore } from "./use-fluxy-room-store";
import type { LiveCursor, LiveCursorPublishInput } from "./live-cursors";
import type { FluxyPresence } from "./presence-patch";

export type { FluxyPresence } from "./presence-patch";

export interface FluxyPresenceOther {
  userId: string;
  presence: FluxyPresence;
  info?: Record<string, unknown>;
}

export function othersFromRoomState(input: {
  liveCursors: Record<string, LiveCursor>;
  livePresence?: Record<string, FluxyPresence>;
  presenceMembers: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
  selfUserId?: string;
}): FluxyPresenceOther[] {
  const byUser = new Map<string, FluxyPresenceOther>();
  for (const member of input.presenceMembers) {
    if (input.selfUserId && member.userId === input.selfUserId) continue;
    byUser.set(member.userId, {
      userId: member.userId,
      presence: { ...(input.livePresence?.[member.userId] ?? {}) },
      info: member.userInfo,
    });
  }
  for (const [userId, presence] of Object.entries(input.livePresence ?? {})) {
    if (input.selfUserId && userId === input.selfUserId) continue;
    const existing = byUser.get(userId);
    byUser.set(userId, {
      userId,
      presence: { ...(existing?.presence ?? {}), ...presence },
      info: existing?.info,
    });
  }
  for (const cursor of Object.values(input.liveCursors)) {
    if (input.selfUserId && cursor.userId === input.selfUserId) continue;
    const existing = byUser.get(cursor.userId);
    const presence: FluxyPresence = {
      ...(existing?.presence ?? {}),
      cursor: { x: cursor.x, y: cursor.y },
    };
    byUser.set(cursor.userId, {
      userId: cursor.userId,
      presence,
      info: existing?.info,
    });
  }
  return [...byUser.values()];
}

export function useOthers(
  store: FluxyRoomStore,
  selfUserId?: string,
): FluxyPresenceOther[] {
  const liveCursors = useFluxyRoomStore(store, (s) => s.liveCursors);
  const livePresence = useFluxyRoomStore(store, (s) => s.livePresence);
  const presenceMembers = useFluxyRoomStore(store, (s) => s.presenceMembers);
  return React.useMemo(
    () => othersFromRoomState({ liveCursors, livePresence, presenceMembers, selfUserId }),
    [liveCursors, livePresence, presenceMembers, selfUserId],
  );
}

export function useUpdateMyPresence(store: FluxyRoomStore) {
  return React.useCallback(
    (patch: Partial<FluxyPresence>) => {
      const cursor = patch.cursor;
      if (cursor && typeof cursor.x === "number" && typeof cursor.y === "number") {
        store.getState().sendCursor(cursor as LiveCursorPublishInput);
      }
      if ("selection" in patch || "agentStatus" in patch || cursor === null) {
        store.getState().sendPresencePatch(patch);
      }
    },
    [store],
  );
}

export function useMyPresence(
  store: FluxyRoomStore,
): [FluxyPresence, (patch: Partial<FluxyPresence>) => void] {
  const [mine, setMine] = React.useState<FluxyPresence>({});
  const updateFromStore = useUpdateMyPresence(store);
  const updateMyPresence = React.useCallback(
    (patch: Partial<FluxyPresence>) => {
      setMine((prev) => {
        const next = { ...prev, ...patch };
        if (patch.cursor === null) next.cursor = null;
        if (patch.selection === null) next.selection = null;
        return next;
      });
      updateFromStore(patch);
    },
    [updateFromStore],
  );
  return [mine, updateMyPresence];
}

export function useBroadcastEvent(store: FluxyRoomStore) {
  return React.useCallback(
    (eventName: string, data: unknown) => {
      store.getState().sendClientEvent(eventName, data);
    },
    [store],
  );
}

export function useEventListener(
  store: FluxyRoomStore,
  listener: (event: {
    eventName: string;
    data: unknown;
    userId: string;
    roomId?: string;
  }) => void,
) {
  const last = useFluxyRoomStore(store, (s) => s.lastClientEvent);
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  const seenRef = React.useRef<typeof last>(null);
  React.useEffect(() => {
    if (!last || last === seenRef.current) return;
    seenRef.current = last;
    listenerRef.current(last);
  }, [last]);
}
