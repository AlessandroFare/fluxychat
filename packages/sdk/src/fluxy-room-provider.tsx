"use client";

import React from "react";
import type { FluxyChatClient } from "./fluxy-chat-client";
import type { FluxyBoundRoom } from "./fluxy-room";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import { FluxyRoomContext } from "./use-bound-room";

const attachRefs = new Map<string, number>();

export interface FluxyRoomProviderProps {
  roomId: string;
  client?: FluxyChatClient;
  autoAttach?: boolean;
  children?: React.ReactNode;
}

export function FluxyRoomProvider({
  roomId,
  client: clientProp,
  autoAttach = true,
  children,
}: FluxyRoomProviderProps) {
  const realtime = useFluxyChatOptional();
  const client = clientProp ?? realtime?.client ?? null;
  const id = roomId.trim();
  const room = React.useMemo(
    () => (client && id ? client.room(id) : null),
    [client, id],
  );

  React.useEffect(() => {
    if (!room || !autoAttach) return;
    const key = `${id}`;
    const next = (attachRefs.get(key) ?? 0) + 1;
    attachRefs.set(key, next);
    if (next === 1) room.attach();
    return () => {
      const left = (attachRefs.get(key) ?? 1) - 1;
      if (left <= 0) {
        attachRefs.delete(key);
        room.detach();
      } else attachRefs.set(key, left);
    };
  }, [room, autoAttach, id]);

  if (!room) return null;
  return <FluxyRoomContext.Provider value={room}>{children}</FluxyRoomContext.Provider>;
}

export function useRoom(): FluxyBoundRoom {
  const room = React.useContext(FluxyRoomContext);
  if (!room) throw new Error("useRoom must be used within FluxyRoomProvider");
  return room;
}

/** Liveblocks `useIsInsideRoom`. */
export function useIsInsideRoom(): boolean {
  return React.useContext(FluxyRoomContext) != null;
}
