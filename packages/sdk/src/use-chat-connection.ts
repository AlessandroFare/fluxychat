"use client";

import React from "react";
import type { FluxyChatEvent } from "./fluxy-chat-client";
import type {
  FluxyChatRoomConnection,
  FluxyRoomConnectionStatus,
} from "./room-connection";
import { FluxyRoomContext } from "./use-bound-room";

/** Ably `useChatConnection`: connection status, error, retryIn. */
export function useChatConnection(connection?: FluxyChatRoomConnection) {
  const ctx = React.useContext(FluxyRoomContext);
  const socket = connection ?? ctx?.connection;
  if (!socket) {
    throw new Error("useChatConnection needs a connection or FluxyRoomProvider");
  }

  const [currentStatus, setCurrentStatus] = React.useState<FluxyRoomConnectionStatus>(
    () => socket.connectionStatus,
  );
  const [error, setError] = React.useState<string | undefined>();
  const [retryIn, setRetryIn] = React.useState<number | undefined>();

  React.useEffect(() => {
    setCurrentStatus(socket.connectionStatus);
    const listener = (event: FluxyChatEvent) => {
      if (event.type !== "state_change") return;
      setCurrentStatus(event.current);
      setError(event.error);
      setRetryIn(event.retryIn);
    };
    socket.onAnyEvent(listener);
    return () => socket.offAnyEvent(listener);
  }, [socket]);

  return { currentStatus, error, retryIn };
}
