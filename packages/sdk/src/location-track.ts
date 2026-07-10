import type { LocationUpdateOutbound } from "@fluxy-chat/protocol";
import type { FluxyChatClient } from "./index";
import { FluxyChatRoomConnection, type FluxyRoomConnectionStatus } from "./room-connection";

export interface LocationTrackOptions {
  trackId?: string;
  minimumIntervalMs?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  onError?: (error: GeolocationPositionError | Error) => void;
  onStatusChange?: (status: FluxyRoomConnectionStatus) => void;
}

export interface LocationTrackController {
  readonly trackId: string;
  readonly connection: FluxyChatRoomConnection;
  stop(): void;
}

export function locationTrack(
  client: FluxyChatClient,
  roomId: string,
  options: LocationTrackOptions = {},
): LocationTrackController {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not available in this environment.");
  }

  const trackId = options.trackId ?? `location-${crypto.randomUUID()}`;
  const minimumIntervalMs = Math.max(1_000, options.minimumIntervalMs ?? 1_000);
  const connection = new FluxyChatRoomConnection(client, roomId, {
    wsReplay: "off",
    replayHistoryOnReconnect: false,
    onStatusChange: options.onStatusChange,
    onConnectionError: options.onError,
  });
  let stopped = false;
  let lastSentAt = 0;
  let pending: GeolocationPosition | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const publish = (position: GeolocationPosition) => {
    if (stopped) return;
    const now = Date.now();
    const remaining = minimumIntervalMs - (now - lastSentAt);
    if (remaining > 0) {
      pending = position;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          const next = pending;
          pending = null;
          if (next) publish(next);
        }, remaining);
      }
      return;
    }

    const { coords } = position;
    const payload: LocationUpdateOutbound = {
      type: "location_update",
      trackId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(position.timestamp).toISOString(),
    };
    try {
      connection.sendJson(payload as unknown as Record<string, unknown>);
      lastSentAt = now;
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error("Unable to publish location."));
    }
  };

  connection.connect();
  const watchId = navigator.geolocation.watchPosition(
    publish,
    (error) => options.onError?.(error),
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: options.maximumAge ?? 5_000,
      timeout: options.timeout ?? 15_000,
    },
  );

  return {
    trackId,
    connection,
    stop() {
      if (stopped) return;
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      if (timer) clearTimeout(timer);
      try {
        connection.sendJson({ type: "location_track_ended", trackId });
      } catch {
        // The server's stale TTL removes the track if the socket is already unavailable.
      }
      connection.close();
    },
  };
}
