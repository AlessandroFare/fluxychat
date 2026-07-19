"use client";

import React from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

interface FleetVehicle {
  id: string;
  name: string;
  plate: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  speed: number | null;
  lastSeenAt: string | null;
}

interface FleetMapViewProps {
  vehicles: FleetVehicle[];
  selectedVehicleId?: string | null;
  onSelectVehicle: (id: string) => void;
}

function FitVehicles({ vehicles }: { vehicles: FleetVehicle[] }) {
  const map = useMap();
  React.useEffect(() => {
    const valid = vehicles.filter((v) => v.lat != null && v.lng != null);
    if (!valid.length) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat!, valid[0].lng!], 15);
      return;
    }
    const bounds = L.latLngBounds(
      valid.map((v) => [v.lat!, v.lng!] as [number, number]),
    );
    map.fitBounds(bounds as unknown as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 16 });
  }, [vehicles, map]);
  return null;
}

function vehicleIcon(vehicle: FleetVehicle, selected: boolean) {
  const color = vehicle.status === "online" ? "#22c55e" : vehicle.status === "en_route" ? "#3b82f6" : "#6b7280";
  const size = selected ? 14 : 10;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size * 2}px;height:${size * 2}px;
      background:${color};
      border:3px solid ${selected ? "#fff" : "rgba(255,255,255,0.8)"};
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      transition:all 0.2s;
    "></div>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
}

export function FleetMapView({ vehicles, selectedVehicleId, onSelectVehicle }: FleetMapViewProps) {
  const active = vehicles.find((v) => v.lat != null && v.lng != null);
  const center: [number, number] = active ? [active.lat!, active.lng!] : [41.9028, 12.4964];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={true}
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.filter((v) => v.lat != null && v.lng != null).map((v) => (
        <Marker
          key={v.id}
          position={[v.lat!, v.lng!]}
          icon={vehicleIcon(v, selectedVehicleId === v.id)}
          eventHandlers={{ click: () => onSelectVehicle(v.id) }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{v.name}</div>
              {v.plate && <div className="text-muted-foreground">{v.plate}</div>}
              <div className="text-muted-foreground capitalize">{v.status}</div>
              {v.speed != null && <div>{Math.round(v.speed * 3.6)} km/h</div>}
            </div>
          </Popup>
        </Marker>
      ))}
      <FitVehicles vehicles={vehicles} />
    </MapContainer>
  );
}
