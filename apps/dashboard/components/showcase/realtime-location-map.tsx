"use client";

import React from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { LocationTrackState } from "@fluxy-chat/sdk";
// react-leaflet ships no styles of its own; without Leaflet's stylesheet the
// tile panes and zoom controls are unpositioned and the map renders broken.
import "leaflet/dist/leaflet.css";

/**
 * Leaflet writes path colors as SVG *presentation attributes*
 * (`stroke="…"`), which do not resolve CSS `var()`. Read the concrete
 * values off the theme once on the client so markers pick up the brand
 * palette instead of falling back to Leaflet's default blue.
 */
function useThemeColors() {
  const [colors, setColors] = React.useState({
    live: "#f0501e",
    liveFill: "#1f2937",
    stale: "#9ca3af",
  });
  React.useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    setColors({
      live: read("--fluxy-cta-color", "#f0501e"),
      liveFill: read("--fluxy-logo-color", "#1f2937"),
      stale: read("--muted-foreground", "#9ca3af"),
    });
  }, []);
  return colors;
}

export function RealtimeLocationMap({ tracks }: { tracks: LocationTrackState[] }) {
  const colors = useThemeColors();
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
            color: track.stale ? colors.stale : colors.live,
            fillColor: track.stale ? colors.stale : colors.liveFill,
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
