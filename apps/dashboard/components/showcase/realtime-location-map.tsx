"use client";

import React from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { LocationTrackState } from "@fluxy-chat/sdk";
import "leaflet/dist/leaflet.css";

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

function useLiveIcon(colors: ReturnType<typeof useThemeColors>) {
  return React.useMemo(
    () =>
      L.divIcon({
        className: "fluxy-marker-live",
        html: `
          <span class="fluxy-marker-live__wrap">
            <span class="fluxy-marker-live__ping" style="background:${colors.live}"></span>
            <span class="fluxy-marker-live__dot" style="background:${colors.liveFill};border-color:${colors.live}"></span>
          </span>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11],
      }),
    [colors],
  );
}

export function RealtimeLocationMap({ tracks }: { tracks: LocationTrackState[] }) {
  const colors = useThemeColors();
  const liveIcon = useLiveIcon(colors);
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
      className="fluxy-location-map min-h-64 w-full"
      aria-label="Live location map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTracks bounds={bounds} />
      {tracks.map((track) =>
        track.stale ? (
          <CircleMarker
            key={track.trackId}
            center={[track.latitude, track.longitude]}
            radius={6}
            pathOptions={{
              color: colors.stale,
              fillColor: colors.stale,
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{track.trackId}</strong>
              <br />
              Last seen {new Date(track.updatedAt).toLocaleTimeString()}
            </Popup>
          </CircleMarker>
        ) : (
          <Marker key={track.trackId} position={[track.latitude, track.longitude]} icon={liveIcon}>
            <Popup>
              <strong>{track.trackId}</strong>
              <br />
              Updated {new Date(track.updatedAt).toLocaleTimeString()}
            </Popup>
          </Marker>
        ),
      )}

      <style>{`
        .fluxy-marker-live__wrap {
          position: relative;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fluxy-marker-live__ping {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          opacity: 0.55;
          animation: fluxy-marker-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .fluxy-marker-live__dot {
          position: relative;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          border: 2px solid;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        @keyframes fluxy-marker-ping {
          0% { transform: scale(0.6); opacity: 0.6; }
          75%, 100% { transform: scale(2.1); opacity: 0; }
        }
        .fluxy-location-map .leaflet-marker-icon {
          transition: transform 0.6s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .fluxy-marker-live__ping { animation: none; opacity: 0; }
          .fluxy-location-map .leaflet-marker-icon { transition: none; }
        }
      `}</style>
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