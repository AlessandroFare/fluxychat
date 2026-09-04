"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MapPin, Truck } from "lucide-react";
import { useLocation, useServerEvents, type LocationTrackState } from "@fluxy-chat/react";
import type { ShowcaseSession } from "../use-showcase-session";

const LocationMap = dynamic(
  () => import("../realtime-location-map").then((m) => m.RealtimeLocationMap),
  { ssr: false },
);

function demoTracks(roomId: string): LocationTrackState[] {
  const now = new Date().toISOString();
  return [
    {
      trackId: "courier-a",
      userId: "courier-a",
      roomId,
      latitude: 45.4642,
      longitude: 9.19,
      updatedAt: now,
      staleAt: now,
      stale: false,
    },
    {
      trackId: "courier-b",
      userId: "courier-b",
      roomId,
      latitude: 45.47,
      longitude: 9.21,
      updatedAt: now,
      staleAt: now,
      stale: false,
    },
  ];
}

export function FleetShowcasePanel({ session }: { session: ShowcaseSession }) {
  const roomId = session.roomId as string;
  const { tracks, activeTracks, connected } = useLocation({
    roomId,
    client: session.client ?? undefined,
  });

  const { lastEvent, connected: serverConnected } = useServerEvents({
    client: session.client,
    roomId,
    filter: (name) => name === "fleet.gps_update",
  });

  const fleetOverlay = React.useMemo(() => {
    if (!lastEvent?.data) return null;
    const lat = Number(lastEvent.data.lat);
    const lng = Number(lastEvent.data.lng);
    const vehicleId = String(lastEvent.data.vehicleId ?? "vehicle");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const now = new Date().toISOString();
    return {
      trackId: vehicleId,
      userId: vehicleId,
      roomId,
      latitude: lat,
      longitude: lng,
      updatedAt: now,
      staleAt: now,
      stale: false,
    } satisfies LocationTrackState;
  }, [lastEvent, roomId]);

  const trackList: LocationTrackState[] = React.useMemo(() => {
    if (tracks.size > 0) {
      return [...tracks.values()].map((t) => ({ ...t, stale: false }));
    }
    if (fleetOverlay) return [fleetOverlay];
    return demoTracks(roomId);
  }, [tracks, fleetOverlay, roomId]);

  const liveSource =
    tracks.size > 0 ? "room location" : fleetOverlay ? "fleet GPS WS" : "sample overlay";

  return (
    <div className="flex h-full min-h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Truck className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
          Fleet dispatch
        </div>
        <span className="text-[11px] text-muted-foreground">
          {connected || serverConnected ? "live" : "connecting"} · {activeTracks.length || trackList.length} active · {liveSource}
        </span>
      </div>
      <div className="relative min-h-64 flex-1 bg-muted">
        <LocationMap tracks={trackList} />
        <div className="absolute bottom-3 left-3 rounded-lg bg-card/95 px-3 py-2 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
          <MapPin className="mr-1 inline size-3.5" aria-hidden />
          {tracks.size > 0
            ? "Live GPS tracks from room"
            : fleetOverlay
              ? `Vehicle ${fleetOverlay.trackId} via fleet.gps_update`
              : "Sample fleet overlay — ingest GPS with roomId or share location"}
        </div>
      </div>
    </div>
  );
}
