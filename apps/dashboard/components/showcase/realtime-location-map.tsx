"use client";

import React from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { LocationTrackState } from "@fluxy-chat/sdk";

export function RealtimeLocationMap({ tracks }: { tracks: LocationTrackState[] }) {
  const bounds = React.useMemo<LatLngBoundsExpression>(
    () => tracks.map((track) => [track.latitude, track.longitude]),
    [tracks],
  );
  const first = tracks[0];

  return (
    <MapContainer
      center={[first.latitude, first.longitude]}
      zoom={15}
      scrollWheelZoom={false}
      className="min-h-64 w-full"
      aria-label="Live location map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTracks bounds={bounds} />
      {tracks.map((track) => (
        <CircleMarker
          key={track.trackId}
          center={[track.latitude, track.longitude]}
          radius={track.stale ? 6 : 8}
          pathOptions={{
            color: track.stale ? "var(--muted-foreground)" : "var(--fluxy-cta-color)",
            fillColor: track.stale ? "var(--muted-foreground)" : "var(--fluxy-logo-color)",
            fillOpacity: 0.9,
            weight: 3,
          }}
        >
          <Popup>
            <strong>{track.trackId}</strong>
            <br />
            Updated {new Date(track.updatedAt).toLocaleTimeString()}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function FitTracks({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }, [bounds, map]);
  return null;
}
