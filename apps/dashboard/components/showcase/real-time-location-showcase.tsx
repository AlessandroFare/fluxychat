"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Loader2, LocateFixed, MapPin, Navigation, Square } from "lucide-react";
import {
  locationTrack,
  useLocation,
  type LocationTrackController,
  type LocationTrackState,
} from "@fluxy-chat/sdk";
import { Button } from "@/components/ui/button";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
  Ident,
  Kw,
  Str,
} from "./feature-code-panel";
import type { ShowcaseSession } from "./use-showcase-session";

const LocationMap = dynamic(
  () => import("./realtime-location-map").then((module) => module.RealtimeLocationMap),
  { ssr: false },
);

export function RealTimeLocationShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel
        title="Live location, down to the last update."
        description="Publish foreground position updates to an authenticated room at a safe one-update-per-second ceiling. Every connected member receives the room’s current tracks, with stale positions expiring automatically."
      >
        <Kw>const</Kw>{" { tracks } = "}<Ident>useLocation</Ident>
        {"({ roomId: "}<Str>{'"delivery:42"'}</Str>{" });\n\n"}
        <Kw>const</Kw>{" trip = "}<Ident>locationTrack</Ident>
        {"(client, "}<Str>{'"delivery:42"'}</Str>{", {\n  trackId: "}
        <Str>{'"courier:maya"'}</Str>{",\n});\n\n"}
        <Ident>trip.stop</Ident>{"(); // end the track explicitly"}
      </FeatureCodePanel>

      <FeaturePreviewFrame label="Real-time location preview" className="min-h-[28rem]">
        {session.status === "loading" ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Connecting to the live location room</span>
          </div>
        ) : session.status === "unavailable" || !session.client || !session.roomId ? (
          <ShowcaseUnavailable error={session.error} onRetry={session.retry} />
        ) : (
          <LocationPanel session={session} />
        )}
      </FeaturePreviewFrame>
    </div>
  );
}

function LocationPanel({ session }: { session: ShowcaseSession }) {
  const { tracks, activeTracks, connected, status } = useLocation({
    roomId: session.roomId as string,
    client: session.client ?? undefined,
  });
  const [controller, setController] = React.useState<LocationTrackController | null>(null);
  const [permission, setPermission] = React.useState<PermissionState | "unsupported">("prompt");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    if (!("permissions" in navigator)) return;
    let cancelled = false;
    void navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (!cancelled) setPermission(result.state);
      result.addEventListener("change", () => setPermission(result.state));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => () => controller?.stop(), [controller]);

  const start = () => {
    if (!session.client || !session.roomId) return;
    setError(null);
    try {
      const next = locationTrack(session.client, session.roomId, {
        trackId: `showcase-${session.client.userId}`,
        onError: (nextError) => {
          setError(nextError.message || "Location access failed.");
          if ("code" in nextError && nextError.code === 1) setPermission("denied");
        },
      });
      setController(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Location access failed.");
    }
  };

  const stop = () => {
    controller?.stop();
    setController(null);
  };

  const trackList = [...tracks.values()];

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-64 flex-1 overflow-hidden bg-muted">
        {trackList.length ? (
          <LocationMap tracks={trackList} />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
              <MapPin className="size-5 text-primary" aria-hidden />
            </span>
            <div className="flex max-w-64 flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">No active tracks yet</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Share this device&apos;s foreground location, or open the demo in another tab to watch positions update.
              </p>
            </div>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
          {connected ? `${activeTracks.length} active` : status}
        </span>
      </div>

      <TrackList tracks={trackList} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        {controller ? (
          <Button size="sm" variant="outline" onClick={stop}>
            <Square data-icon="inline-start" />
            Stop sharing
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={permission === "denied" || permission === "unsupported"}>
            <Navigation data-icon="inline-start" />
            Share live location
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          {permission === "denied"
            ? "Location is blocked in browser settings."
            : permission === "unsupported"
              ? "Geolocation is unavailable in this browser."
              : "Foreground only · expires after 30 seconds"}
        </span>
        {error ? <p className="basis-full text-[11px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function TrackList({ tracks }: { tracks: LocationTrackState[] }) {
  if (!tracks.length) return null;
  return (
    <ul className="flex max-h-36 flex-col overflow-y-auto border-t border-border" aria-label="Location tracks">
      {tracks.map((track) => (
        <li key={track.trackId} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <LocateFixed className="size-4 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{track.trackId}</p>
            <p className="text-[11px] text-muted-foreground">
              {track.accuracy ? `Accurate to ${Math.round(track.accuracy)} m · ` : ""}
              {new Date(track.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">{track.stale ? "Stale" : "Live"}</span>
        </li>
      ))}
    </ul>
  );
}
