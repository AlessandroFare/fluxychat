"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LatLngPoint { lat: number; lng: number; address?: string | null; }
interface VehiclePos { lat: number; lng: number; heading: number | null; speed: number | null; }

const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropoffIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🏁</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function vehicleIcon(heading: number | null) {
  const angle = heading ?? 0;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;
      background:#3b82f6;
      border:3px solid rgba(255,255,255,0.9);
      border-radius:8px 8px 8px 2px;
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
      transform:rotate(${angle}deg);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
      transition:transform 1s ease;
    ">🚚</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [points, map]);
  return null;
}

interface DeliveryMapProps {
  pickup: LatLngPoint;
  dropoff: LatLngPoint;
  vehiclePos: VehiclePos | null;
  status: string;
}

export function DeliveryMap({ pickup, dropoff, vehiclePos, status }: DeliveryMapProps) {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    const from = vehiclePos || pickup;
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data?.routes?.[0]?.geometry?.coordinates) {
          setRouteCoords(data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
        }
      })
      .catch(() => {});
  }, [pickup, dropoff, vehiclePos]);

  const allPoints: [number, number][] = [
    [pickup.lat, pickup.lng],
    ...(vehiclePos ? [[vehiclePos.lat, vehiclePos.lng] as [number, number]] : []),
    [dropoff.lat, dropoff.lng],
  ];

  return (
    <MapContainer
      center={[(pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2]}
      zoom={13}
      scrollWheelZoom={true}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
        <Popup>{pickup.address || "Pickup"}</Popup>
      </Marker>
      <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
        <Popup>{dropoff.address || "Dropoff"}</Popup>
      </Marker>
      {vehiclePos && status !== "completed" && (
        <Marker position={[vehiclePos.lat, vehiclePos.lng]} icon={vehicleIcon(vehiclePos.heading)}>
          <Popup>Vehicle position</Popup>
        </Marker>
      )}
      {routeCoords.length > 1 && (
        <Polyline positions={routeCoords} color="#3b82f6" weight={4} opacity={0.6} />
      )}
      <FitAll points={allPoints} />
    </MapContainer>
  );
}
