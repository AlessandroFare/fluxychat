"use client";

import React from "react";
import type { LocationTrack } from "@fluxy-chat/protocol";
import type { FluxyChatClient, FluxyChatEvent } from "./index";
import { applyLocationPrivacy, type LocationPrivacyOptions } from "./location-privacy";
import { FluxyChatRoomConnection, type FluxyRoomConnectionStatus } from "./room-connection";
import { useFluxyChatOptional } from "./use-fluxy-chat";

export interface UseLocationOptions extends LocationPrivacyOptions {
  roomId: string;
  client?: FluxyChatClient;
  staleAfterMs?: number;
  /** When set, only show tracks owned by this user (privacy mode for non-moderators). */
  viewerUserId?: string;
}

export interface LocationTrackState extends LocationTrack {
  stale: boolean;
}

export function useLocation({
  roomId,
  client: clientProp,
  staleAfterMs = 30_000,
  precisionMeters,
  maxAccuracyMeters,
  viewerUserId,
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
      if (viewerUserId && track.userId !== viewerUserId) continue;

      const staleAt = Math.min(
        Number.isFinite(Date.parse(track.staleAt)) ? Date.parse(track.staleAt) : Infinity,
        Date.parse(track.updatedAt) + staleAfterMs,
      );
      if (now >= staleAt) continue;

      const sanitized = applyLocationPrivacy(track, { precisionMeters, maxAccuracyMeters });
      if (!sanitized) continue;

      next.set(trackId, {
        ...track,
        latitude: sanitized.latitude,
        longitude: sanitized.longitude,
        accuracy: sanitized.accuracy,
        stale: false,
      });
    }
    return next;
  }, [tracks, now, staleAfterMs, precisionMeters, maxAccuracyMeters, viewerUserId]);

  return {
    tracks: visibleTracks,
    activeTracks: [...visibleTracks.values()],
    status,
    connected: status === "connected",
  };
}
