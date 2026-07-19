"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Truck, MapPin, Route, Circle, Plus, RefreshCw, Play, CheckCircle, XCircle, Loader2, ExternalLink, Mic,
} from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import { DynamicPricing } from "@/components/fleet/dynamic-pricing";

const FleetMapView = dynamic(
  () => import("@/components/fleet/fleet-map-view").then((m) => m.FleetMapView),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center text-muted-foreground">Loading map...</div> },
);

const WORKER_URL = getPublicWorkerUrl();
const REFRESH_MS = 10000;

type FleetTab = "vehicles" | "trips" | "geofences";

interface Vehicle { id: string; name: string; plate: string | null; driverId: string | null; status: string; lat: number | null; lng: number | null; speed: number | null; heading?: number | null; lastSeenAt: string | null; createdAt: string; }
interface Trip { id: string; vehicleId: string; status: string; startedAt: string | null; completedAt: string | null; driverId: string | null; pickup: { lat: number; lng: number; address: string | null }; dropoff: { lat: number; lng: number; address: string | null }; distanceMeters: number | null; createdAt: string; }
interface Geofence { id: string; name: string; lat: number; lng: number; radiusMeters: number; createdAt: string; }

function statusBadge(status: string) {
  const map: Record<string, string> = { online: "bg-green-500", en_route: "bg-blue-500", idle: "bg-yellow-500", offline: "bg-gray-400", pending: "bg-yellow-500", active: "bg-blue-500", completed: "bg-green-500", cancelled: "bg-red-400" };
  return <span className={cn("inline-block h-2 w-2 rounded-full", map[status] || "bg-gray-400")} title={status} />;
}

export default function FleetPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [tab, setTab] = useState<FleetTab>("vehicles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showCreateGeofence, setShowCreateGeofence] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({ baseUrl: WORKER_URL, userId: "console", token });
  }, [token]);

  const refresh = useCallback(async () => {
    if (!client) return;
    setPricingLoading(true);
    try {
      const [v, t, g, p] = await Promise.all([
        client.listFleetVehicles(),
        client.listFleetTrips(),
        client.listFleetGeofences(),
        client.getDynamicPricing().catch(() => ({ pricing: null })),
      ]);
      setVehicles(v.vehicles);
      setTrips(t.trips);
      setGeofences(g.geofences);
      setPricing(p.pricing);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fleet data");
    } finally {
      setLoading(false);
      setPricingLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const vehicleTrips = trips.filter((t) => t.vehicleId === selectedVehicleId);
  const tripStatusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    trips.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [trips]);

  const [newVehicleName, setNewVehicleName] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateVehicle = async () => {
    if (!client || !newVehicleName.trim()) return;
    setCreating(true);
    try {
      await client.createFleetVehicle({ name: newVehicleName.trim(), plate: newVehiclePlate.trim() || undefined });
      setNewVehicleName(""); setNewVehiclePlate("");
      setShowCreateVehicle(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create vehicle");
    } finally { setCreating(false); }
  };

  const [newTripVehicleId, setNewTripVehicleId] = useState("");
  const [newTripPickupLat, setNewTripPickupLat] = useState("");
  const [newTripPickupLng, setNewTripPickupLng] = useState("");
  const [newTripDropoffLat, setNewTripDropoffLat] = useState("");
  const [newTripDropoffLng, setNewTripDropoffLng] = useState("");
  const [newTripPickupAddr, setNewTripPickupAddr] = useState("");
  const [newTripDropoffAddr, setNewTripDropoffAddr] = useState("");

  const handleCreateTrip = async () => {
    if (!client || !newTripVehicleId || !newTripPickupLat || !newTripPickupLng || !newTripDropoffLat || !newTripDropoffLng) return;
    setCreating(true);
    try {
      await client.createFleetTrip({
        vehicleId: newTripVehicleId,
        pickupLat: Number(newTripPickupLat), pickupLng: Number(newTripPickupLng),
        dropoffLat: Number(newTripDropoffLat), dropoffLng: Number(newTripDropoffLng),
        pickupAddress: newTripPickupAddr.trim() || undefined,
        dropoffAddress: newTripDropoffAddr.trim() || undefined,
      });
      setShowCreateTrip(false);
      setNewTripVehicleId(""); setNewTripPickupLat(""); setNewTripPickupLng("");
      setNewTripDropoffLat(""); setNewTripDropoffLng("");
      setNewTripPickupAddr(""); setNewTripDropoffAddr("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create trip");
    } finally { setCreating(false); }
  };

  const [newGeofenceName, setNewGeofenceName] = useState("");
  const [newGeofenceLat, setNewGeofenceLat] = useState("");
  const [newGeofenceLng, setNewGeofenceLng] = useState("");
  const [newGeofenceRadius, setNewGeofenceRadius] = useState("100");

  const handleCreateGeofence = async () => {
    if (!client || !newGeofenceName.trim() || !newGeofenceLat || !newGeofenceLng) return;
    setCreating(true);
    try {
      await client.createFleetGeofence({
        name: newGeofenceName.trim(),
        lat: Number(newGeofenceLat), lng: Number(newGeofenceLng),
        radiusMeters: Number(newGeofenceRadius) || 100,
      });
      setShowCreateGeofence(false);
      setNewGeofenceName(""); setNewGeofenceLat(""); setNewGeofenceLng("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create geofence");
    } finally { setCreating(false); }
  };

  const handleUpdateTripStatus = async (tripId: string, status: "active" | "completed" | "cancelled") => {
    if (!client) return;
    try {
      await client.updateFleetTripStatus(tripId, status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update trip");
    }
  };

  if (!token) {
    return (
      <ConsoleShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Connect a project session to use Fleet Tracking.</p>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Fleet Tracking"
        description="Real-time GPS tracking, trip management, and geofencing"
      />

      {error && (
        <div className="mx-4 mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      <div className="flex flex-1 gap-3 p-4 pt-2" style={{ height: "calc(100vh - 10rem)" }}>
        <div className="relative flex-1 overflow-hidden rounded-lg border">
          <div className="absolute left-2 top-2 z-[1000] flex gap-1 rounded-md bg-background/80 p-1 shadow backdrop-blur">
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreateVehicle(true)}><Plus className="h-4 w-4" /> Vehicle</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreateTrip(true)}><Route className="h-4 w-4" /> Trip</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreateGeofence(true)}><Circle className="h-4 w-4" /> Geofence</Button>
          </div>
          <div className="h-full w-full">
            <FleetMapView
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
        </div>

        <div className="flex w-80 flex-col gap-2">
          <div className="flex rounded-lg border">
            {(["vehicles", "trips", "geofences"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors",
                  tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Vehicle tab ── */}
          {tab === "vehicles" && (
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
              {loading && vehicles.length === 0 && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
              {!loading && vehicles.length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground">No vehicles yet. Create one from the map toolbar.</p>}
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVehicleId(v.id); setTab("trips"); }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                    selectedVehicleId === v.id && "bg-muted",
                  )}
                >
                  {statusBadge(v.status)}
                  <span className="flex-1 font-medium truncate">{v.name}</span>
                  {v.speed != null && <span className="text-muted-foreground">{Math.round(v.speed * 3.6)} km/h</span>}
                  <span className="text-muted-foreground capitalize">{v.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Trips tab ── */}
          {tab === "trips" && (
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
              {loading && trips.length === 0 && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
              {!loading && trips.length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground">No trips yet. Create one from the map toolbar.</p>}
              {trips.map((t) => (
                <div key={t.id} className="rounded-md border px-2 py-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    {statusBadge(t.status)}
                    <span className="flex-1 font-medium truncate">
                      {vehicles.find((v) => v.id === t.vehicleId)?.name || t.vehicleId}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    <Link
                      href={`/fleet/tracking/${t.id}`}
                      className="text-primary hover:underline flex items-center gap-0.5"
                      title="Live tracking with chat"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  {t.distanceMeters != null && <div className="mt-0.5 text-[10px] text-muted-foreground">{(t.distanceMeters / 1000).toFixed(1)} km</div>}
                  {t.status === "pending" && (
                    <div className="mt-1 flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => handleUpdateTripStatus(t.id, "active")}>
                        <Play className="mr-1 h-3 w-3" /> Start
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => handleUpdateTripStatus(t.id, "cancelled")}>
                        <XCircle className="mr-1 h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  )}
                  {t.status === "active" && (
                    <div className="mt-1 flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => handleUpdateTripStatus(t.id, "completed")}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Complete
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => handleUpdateTripStatus(t.id, "cancelled")}>
                        <XCircle className="mr-1 h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Geofences tab ── */}
          {tab === "geofences" && (
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
              {geofences.length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground">No geofences yet. Create one from the map toolbar.</p>}
              {geofences.map((g) => (
                <div key={g.id} className="rounded-md border px-2 py-1.5 text-xs">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-muted-foreground">{g.lat.toFixed(4)}, {g.lng.toFixed(4)} &mdash; {g.radiusMeters}m radius</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Selected vehicle detail ── */}
          {selectedVehicle && (
            <div className="rounded-lg border p-2 text-xs">
              <div className="font-semibold">{selectedVehicle.name}</div>
              {selectedVehicle.plate && <div className="text-muted-foreground">{selectedVehicle.plate}</div>}
              <div className="mt-1 flex items-center gap-2">
                {statusBadge(selectedVehicle.status)}
                <span className="capitalize">{selectedVehicle.status}</span>
              </div>
              {selectedVehicle.speed != null && <div>Speed: {Math.round(selectedVehicle.speed * 3.6)} km/h</div>}
              {selectedVehicle.lastSeenAt && <div className="text-muted-foreground">Last seen: {new Date(selectedVehicle.lastSeenAt).toLocaleTimeString()}</div>}
              <div className="mt-1 text-muted-foreground">
                {vehicleTrips.length} trip{vehicleTrips.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* ── Summary bar ── */}
          <div className="flex gap-1 rounded-lg border p-2 text-xs">
            <div className="flex-1 text-center"><div className="font-semibold">{vehicles.length}</div><div className="text-muted-foreground">Vehicles</div></div>
            <div className="flex-1 text-center"><div className="font-semibold">{vehicles.filter((v) => v.status === "online").length}</div><div className="text-muted-foreground">Online</div></div>
            <div className="flex-1 text-center"><div className="font-semibold">{trips.filter((t) => t.status === "active").length}</div><div className="text-muted-foreground">Active trips</div></div>
            <div className="flex-1 text-center"><div className="font-semibold">{geofences.length}</div><div className="text-muted-foreground">Geofences</div></div>
          </div>

          {/* ── Dynamic Pricing ── */}
          <DynamicPricing data={pricing} loading={pricingLoading} />
        </div>
      </div>

      {/* ── Create Vehicle Dialog ── */}
      {showCreateVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateVehicle(false)}>
          <div className="w-80 rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Add Vehicle</h3>
            <input className="mb-2 w-full rounded border px-2 py-1.5 text-sm" placeholder="Vehicle name *" value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} />
            <input className="mb-3 w-full rounded border px-2 py-1.5 text-sm" placeholder="License plate (optional)" value={newVehiclePlate} onChange={(e) => setNewVehiclePlate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateVehicle(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateVehicle} disabled={creating || !newVehicleName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Trip Dialog ── */}
      {showCreateTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateTrip(false)}>
          <div className="w-96 rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Create Trip</h3>
            <select className="mb-2 w-full rounded border px-2 py-1.5 text-sm" value={newTripVehicleId} onChange={(e) => setNewTripVehicleId(e.target.value)}>
              <option value="">Select vehicle *</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Pickup lat *" value={newTripPickupLat} onChange={(e) => setNewTripPickupLat(e.target.value)} />
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Pickup lng *" value={newTripPickupLng} onChange={(e) => setNewTripPickupLng(e.target.value)} />
            </div>
            <input className="mb-2 w-full rounded border px-2 py-1.5 text-sm" placeholder="Pickup address (optional)" value={newTripPickupAddr} onChange={(e) => setNewTripPickupAddr(e.target.value)} />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Dropoff lat *" value={newTripDropoffLat} onChange={(e) => setNewTripDropoffLat(e.target.value)} />
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Dropoff lng *" value={newTripDropoffLng} onChange={(e) => setNewTripDropoffLng(e.target.value)} />
            </div>
            <input className="mb-3 w-full rounded border px-2 py-1.5 text-sm" placeholder="Dropoff address (optional)" value={newTripDropoffAddr} onChange={(e) => setNewTripDropoffAddr(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateTrip(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateTrip} disabled={creating || !newTripVehicleId || !newTripPickupLat || !newTripPickupLng || !newTripDropoffLat || !newTripDropoffLng}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Geofence Dialog ── */}
      {showCreateGeofence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateGeofence(false)}>
          <div className="w-80 rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Create Geofence</h3>
            <input className="mb-2 w-full rounded border px-2 py-1.5 text-sm" placeholder="Geofence name *" value={newGeofenceName} onChange={(e) => setNewGeofenceName(e.target.value)} />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Center lat *" value={newGeofenceLat} onChange={(e) => setNewGeofenceLat(e.target.value)} />
              <input className="rounded border px-2 py-1.5 text-sm" placeholder="Center lng *" value={newGeofenceLng} onChange={(e) => setNewGeofenceLng(e.target.value)} />
            </div>
            <input className="mb-3 w-full rounded border px-2 py-1.5 text-sm" placeholder="Radius in meters (default: 100)" value={newGeofenceRadius} onChange={(e) => setNewGeofenceRadius(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateGeofence(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateGeofence} disabled={creating || !newGeofenceName.trim() || !newGeofenceLat || !newGeofenceLng}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voice dispatch floating button */}
      <VoiceDispatch client={client} vehicles={vehicles} refresh={refresh} />
    </ConsoleShell>
  );
}

function VoiceDispatch({ client, vehicles, refresh }: { client: FluxyChatClient | null; vehicles: Vehicle[]; refresh: () => Promise<void> }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [matched, setMatched] = useState(false);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setResult("Voice recognition not supported in this browser.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    setTranscript("");
    setMatched(false);

    recognition.onresult = (event: any) => {
      const t = event.results[0][0].transcript.toLowerCase();
      setTranscript(t);
      if (event.results[0].isFinal) {
        if (t.includes("nearest driver") || t.includes("assign") || t.includes("dispatch")) {
          setMatched(true);
          setResult("Finding nearest available driver...");
          const pickupMatch = t.match(/pickup at ([\d.-]+), ([\d.-]+)/);
          const dropoffMatch = t.match(/dropoff at ([\d.-]+), ([\d.-]+)/);
          const pickupLat = pickupMatch ? Number(pickupMatch[1]) : 41.9;
          const pickupLng = pickupMatch ? Number(pickupMatch[2]) : 12.5;
          const dropoffLat = dropoffMatch ? Number(dropoffMatch[1]) : 41.91;
          const dropoffLng = dropoffMatch ? Number(dropoffMatch[2]) : 12.51;
          client?.matchDelivery({ pickupLat, pickupLng, dropoffLat, dropoffLng })
            .then((r) => {
              setResult(`Matched with ${r.driver.name} — ETA ${r.driver.etaMinutes} min`);
              refresh();
            })
            .catch((e) => setResult(`Dispatch failed: ${e.message}`));
        } else {
          setResult("Say \"assign nearest driver\" or \"dispatch to [lat], [lng]\"");
        }
        setListening(false);
      }
    };
    recognition.onerror = () => { setResult("Voice recognition error"); setListening(false); };
    recognition.start();
    setListening(true);
  };

  return (
    <>
      <button
        onClick={startListening}
        disabled={listening}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all",
          listening ? "bg-red-500 animate-pulse" : "bg-primary hover:scale-105",
        )}
        title="Voice dispatch — say 'assign nearest driver'"
      >
        <Mic className={cn("h-6 w-6 text-white", listening && "animate-pulse")} />
      </button>
      {result && (
        <div className={cn(
          "fixed bottom-24 right-6 z-50 max-w-xs rounded-xl px-4 py-3 text-xs shadow-lg",
          matched ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-background border",
        )}>
          {transcript && <div className="mb-1 italic text-muted-foreground">"{transcript}"</div>}
          <div>{result}</div>
          <button onClick={() => setResult(null)} className="mt-1 text-primary hover:underline">Dismiss</button>
        </div>
      )}
    </>
  );
}
