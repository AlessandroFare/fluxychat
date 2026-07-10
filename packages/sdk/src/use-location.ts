"use client";

import React from "react";
import type { LocationTrack } from "@fluxy-chat/protocol";
import type { FluxyChatClient, FluxyChatEvent } from "./index";
import { FluxyChatRoomConnection, type FluxyRoomConnectionStatus } from "./room-connection";
import { useFluxyChatOptional } from "./use-fluxy-chat";

export interface UseLocationOptions {
  roomId: string;
  client?: FluxyChatClient;
  staleAfterMs?: number;
}

export interface LocationTrackState extends LocationTrack {
  stale: boolean;
}

export function useLocation({
  roomId,
  client: clientProp,
  staleAfterMs = 30_000,
}: UseLocationOptions) {
  const realtime = useFluxyChatOptional();
  const client = clientProp ?? realtime?.client ?? null;
  const [tracks, setTracks] = React.useState<ReadonlyMap<string, LocationTrack>>(new Map());
  const [status, setStatus] = React.useState<FluxyRoomConnectionStatus>("idle");
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!client || !roomId) {
      setTracks(new Map());
      setStatus("idle");
      return;
    }

    const connection = new FluxyChatRoomConnection(client, roomId, {
      wsReplay: "off",
      replayHistoryOnReconnect: false,
      onStatusChange: setStatus,
    });
    const handleEvent = (event: FluxyChatEvent) => {
      if (event.type === "location_snapshot") {
        setTracks(new Map(event.tracks.map((track) => [track.trackId, track])));
        return;
      }
      if (event.type === "location_update") {
        setTracks((current) => {
          const next = new Map(current);
          next.set(event.trackId, event);
          return next;
        });
        return;
      }
      if (event.type === "location_track_ended") {
        setTracks((current) => {
          const next = new Map(current);
          next.delete(event.trackId);
          return next;
        });
      }
    };

    connection.addEventListener("message", handleEvent);
    connection.connect();
    return () => {
      connection.removeEventListener("message", handleEvent);
      connection.close();
    };
  }, [client, roomId]);

  const visibleTracks = React.useMemo<ReadonlyMap<string, LocationTrackState>>(() => {
    const next = new Map<string, LocationTrackState>();
    for (const [trackId, track] of tracks) {
      const staleAt = Math.min(
        Number.isFinite(Date.parse(track.staleAt)) ? Date.parse(track.staleAt) : Infinity,
        Date.parse(track.updatedAt) + staleAfterMs,
      );
      next.set(trackId, { ...track, stale: now >= staleAt });
    }
    return next;
  }, [tracks, now, staleAfterMs]);

  return {
    tracks: visibleTracks,
    activeTracks: [...visibleTracks.values()].filter((track) => !track.stale),
    status,
    connected: status === "connected",
  };
}
