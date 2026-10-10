"use client";

import React from "react";
import type { FluxyRoomStore } from "./fluxy-room-store";
import { useFluxyRoomStore } from "./use-fluxy-room-store";
import type { LiveCursor, LiveCursorPublishInput } from "./live-cursors";
import type { FluxyPresence } from "./presence-patch";
import {
  classifyPresenceAvatars,
  pruneLeavers,
  selfFromMembers,
  type FluxyLeaver,
  type FluxyPresenceAvatar,
} from "./presence-avatars";

export type { FluxyPresence, FluxyUiLocation } from "./presence-patch";

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

export function useSelf(
  store: FluxyRoomStore,
  selfUserId: string,
) {
  const presenceMembers = useFluxyRoomStore(store, (s) => s.presenceMembers);
  return React.useMemo(
    () => selfFromMembers(presenceMembers, selfUserId),
    [presenceMembers, selfUserId],
  );
}

export function useLeavers(store: FluxyRoomStore): FluxyLeaver[] {
  const presenceLeavers = useFluxyRoomStore(store, (s) => s.presenceLeavers);
  return React.useMemo(
    () => Object.values(pruneLeavers(presenceLeavers, Date.now())),
    [presenceLeavers],
  );
}

export function usePresenceAvatars(
  store: FluxyRoomStore,
  selfUserId: string,
): FluxyPresenceAvatar[] {
  const presenceMembers = useFluxyRoomStore(store, (s) => s.presenceMembers);
  const presenceLeavers = useFluxyRoomStore(store, (s) => s.presenceLeavers);
  return React.useMemo(
    () =>
      classifyPresenceAvatars({
        selfUserId,
        members: presenceMembers,
        leavers: presenceLeavers,
      }),
    [selfUserId, presenceMembers, presenceLeavers],
  );
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

export function useOther(
  store: FluxyRoomStore,
  userId: string,
  selfUserId?: string,
): FluxyPresenceOther | null {
  const others = useOthers(store, selfUserId);
  return React.useMemo(
    () => others.find((row) => row.userId === userId) ?? null,
    [others, userId],
  );
}

/** Liveblocks `useOthersMapped` — map each other member. */
export function useOthersMapped<T>(
  store: FluxyRoomStore,
  mapper: (other: FluxyPresenceOther) => T,
  selfUserId?: string,
): T[] {
  const others = useOthers(store, selfUserId);
  return React.useMemo(() => others.map(mapper), [others, mapper]);
}

/** Liveblocks connection ids; we use userId (one presence member, many sockets). */
export function useOthersConnectionIds(store: FluxyRoomStore, selfUserId?: string): string[] {
  const others = useOthers(store, selfUserId);
  return React.useMemo(() => others.map((row) => row.userId), [others]);
}

export type FluxyLostConnectionEvent = "lost" | "restored" | "failed";

export function lostConnectionEventFromStatus(
  previous: string,
  current: string,
): FluxyLostConnectionEvent | null {
  const lostish = (status: string) =>
    status === "reconnecting" ||
    status === "suspended" ||
    status === "degraded" ||
    status === "degraded-http";
  if (current === "failed") return "failed";
  if (lostish(current) && !lostish(previous)) return "lost";
  if (current === "connected" && lostish(previous)) return "restored";
  return null;
}

/** Liveblocks `useOthersListener`. */
export function useOthersListener(
  store: FluxyRoomStore,
  listener: (others: FluxyPresenceOther[]) => void,
  selfUserId?: string,
) {
  const others = useOthers(store, selfUserId);
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  React.useEffect(() => {
    listenerRef.current(others);
  }, [others]);
}

/** Liveblocks `useErrorListener` — connection errors on the room store. */
export function useErrorListener(
  store: FluxyRoomStore,
  listener: (error: Error) => void,
) {
  const connectionError = useFluxyRoomStore(store, (s) => s.connectionError);
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  const seenRef = React.useRef<Error | null>(null);
  React.useEffect(() => {
    if (!connectionError || connectionError === seenRef.current) return;
    seenRef.current = connectionError;
    listenerRef.current(connectionError);
  }, [connectionError]);
}

/** Liveblocks `useLostConnectionListener`. */
export function useLostConnectionListener(
  store: FluxyRoomStore,
  listener: (event: FluxyLostConnectionEvent) => void,
) {
  const status = useFluxyRoomStore(store, (s) => s.connectionStatus);
  const prevRef = React.useRef(status);
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  React.useEffect(() => {
    const previous = prevRef.current;
    prevRef.current = status;
    const event = lostConnectionEventFromStatus(previous, status);
    if (event) listenerRef.current(event);
  }, [status]);
}
