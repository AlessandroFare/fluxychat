"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Truck, Navigation, MapPin, Clock, Wifi, WifiOff, Crosshair, Play, CheckCircle, XCircle, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import * as Y from "yjs";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import { useYDoc } from "@/components/fleet/use-ydoc";

const WORKER_URL = getPublicWorkerUrl();

interface Trip { id: string; vehicleId: string; status: string; startedAt: string | null; completedAt: string | null; pickup: { lat: number; lng: number; address: string | null }; dropoff: { lat: number; lng: number; address: string | null }; distanceMeters: number | null; createdAt: string; }
interface Vehicle { id: string; name: string; plate: string | null; }

export default function DriverPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tracking, setTracking] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [gpsStatus, setGpsStatus] = useState<"inactive" | "active" | "error">("inactive");
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const watchRef = useRef<number | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingGpsRef = useRef<number>(0);

  const { synced: ySynced } = useYDoc(!!token);

  const client = React.useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({ baseUrl: WORKER_URL, userId: "console", token });
  }, [token]);

  const loadData = useCallback(async () => {
    if (!client) return;
    try {
      const [vRes, tRes] = await Promise.all([client.listFleetVehicles(), client.listFleetTrips()]);
      if (vRes.vehicles.length > 0) {
        setVehicle(vRes.vehicles[0]);
        const doc = (window as any).__Y_DOC;
        if (doc) {
          const vm = doc.getMap("vehicle");
          vm.set("id", vRes.vehicles[0].id);
          vm.set("name", vRes.vehicles[0].name);
        }
      }
      setTrips(tRes.trips);
      setLastSync(new Date());
      const active = tRes.trips.find((t) => t.status === "active");
      if (active) {
        setActiveTrip(active as Trip);
        const doc = (window as any).__Y_DOC;
        if (doc) {
          const tm = doc.getMap("trips");
          tm.set(active.id, active);
        }
      }
    } catch { /* noop */ }
  }, [client]);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 15000); return () => clearInterval(iv); }, [loadData]);

  useEffect(() => {
    const handleOnline = async () => {
      setOffline(false);
      loadData();
      const doc = (window as any).__Y_DOC;
      if (doc) {
        const gq = doc.getArray("gpsQueue");
        const queue = gq.toArray() as { vehicleId: string; lat: number; lng: number; speed?: number; heading?: number; accuracy?: number; timestamp: number }[];
        if (queue.length > 0 && client) {
          for (const entry of queue) {
            try { await client.ingestGps({ vehicleId: entry.vehicleId, lat: entry.lat, lng: entry.lng, speed: entry.speed, heading: entry.heading, accuracy: entry.accuracy }); } catch { /* skip */ }
          }
          gq.delete(0, gq.length);
        }
      }
    };
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [client, loadData]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => setSwReady(true)).catch(() => {});
    }
  }, []);

  useEffect(() => { (window as any).__Y_DOC = undefined; }, []);

  const queueGpsToYDoc = (vehicleId: string, lat: number, lng: number, speed?: number, heading?: number, accuracy?: number) => {
    const doc = (window as any).__Y_DOC;
    if (!doc) return;
    const gq = doc.getArray("gpsQueue");
    doc.transact(() => {
      gq.push([{ vehicleId, lat, lng, speed, heading, accuracy, timestamp: Date.now() }]);
    });
    pendingGpsRef.current++;
  };

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsError("Geolocation not supported"); return; }
    setGpsStatus("active");
    setGpsError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { setPos(p); setGpsStatus("active"); setGpsError(null); },
      (e) => { setGpsError(e.message); setGpsStatus("error"); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    gpsIntervalRef.current = setInterval(() => {
      if (pos && vehicle) {
        const payload = { vehicleId: vehicle.id, lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed ?? undefined, heading: pos.coords.heading ?? undefined, accuracy: pos.coords.accuracy };
        if (navigator.onLine) {
          client?.ingestGps(payload).catch(() => { queueGpsToYDoc(vehicle.id, pos.coords.latitude, pos.coords.longitude, pos.coords.speed ?? undefined, pos.coords.heading ?? undefined, pos.coords.accuracy); });
        } else {
          queueGpsToYDoc(vehicle.id, pos.coords.latitude, pos.coords.longitude, pos.coords.speed ?? undefined, pos.coords.heading ?? undefined, pos.coords.accuracy);
        }
      }
    }, 10000);
    setTracking(true);
  };

  const stopTracking = () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    watchRef.current = null;
    gpsIntervalRef.current = null;
    setTracking(false);
    setGpsStatus("inactive");
  };

  useEffect(() => { return () => { stopTracking(); }; }, []);

  const updateTripStatus = async (tripId: string, status: "active" | "completed" | "cancelled") => {
    if (!client) return;
    const doc = (window as any).__Y_DOC;
    if (doc) {
      const tm = doc.getMap("trips");
      doc.transact(() => {
        tm.set(tripId, { ...tm.get(tripId), status });
      });
    }
    if (navigator.onLine) {
      try {
        await client.updateFleetTripStatus(tripId, status);
        if (status === "completed" || status === "cancelled") setActiveTrip(null);
        await loadData();
      } catch { /* noop */ }
    }
  };

  const acceptTrip = async (tripId: string) => {
    if (!client) return;
    const doc = (window as any).__Y_DOC;
    if (doc) {
      const tm = doc.getMap("trips");
      doc.transact(() => { tm.set(tripId, { ...tm.get(tripId), status: "active" }); });
    }
    if (navigator.onLine) {
      try {
        await client.updateFleetTripStatus(tripId, "active");
        await loadData();
      } catch { /* noop */ }
    }
  };

  const syncFromYDoc = () => {
    const doc = (window as any).__Y_DOC;
    if (!doc) return;
    const tm = doc.getMap("trips");
    const restored: Trip[] = [];
    tm.forEach((v: any, key: string) => {
      if (v && key) restored.push(v as Trip);
    });
    if (restored.length > 0) {
      setTrips(restored);
      const active = restored.find((t) => t.status === "active");
      if (active) setActiveTrip(active);
    }
  };

  const myTrips = trips.filter((t) => t.vehicleId === vehicle?.id);

  return (
    <ConsoleShell className="max-w-none">
      <ConsolePageHeader
        title="Driver app"
        description="Mobile companion for couriers — share GPS with Fleet Tracking, accept trips, and work offline. Pair with the fleet console to dispatch and watch live positions."
        actions={
          <Link
            href="/fleet"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-3.5" />
            Fleet console
          </Link>
        }
      />

      <div className="mx-auto flex max-w-md flex-col pb-8 pt-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-gray-50 shadow-lg dark:bg-gray-950">
          <div className="bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                <span className="font-bold text-sm">FluxyTrack Driver</span>
              </div>
              <div className="flex items-center gap-2">
                {ySynced ? <span className="h-2 w-2 rounded-full bg-green-300" title="Y.Doc synced" /> : <span title="Syncing..."><Loader2 className="h-3 w-3 animate-spin" /></span>}
                {offline ? <WifiOff className="h-4 w-4 text-yellow-200" /> : <Wifi className="h-4 w-4" />}
                <span className={cn("h-2 w-2 rounded-full", gpsStatus === "active" ? "bg-green-300" : gpsStatus === "error" ? "bg-red-300" : "bg-gray-300")} />
              </div>
            </div>
            {vehicle && <div className="mt-1 text-xs opacity-80">{vehicle.name} {vehicle.plate && `· ${vehicle.plate}`}</div>}
            {lastSync && <div className="text-[9px] opacity-60">Last sync: {lastSync.toLocaleTimeString()}</div>}
          </div>

      {!offline && pendingGpsRef.current > 0 && (
        <div className="mx-3 mt-2">
          <button onClick={syncFromYDoc} className="w-full rounded-lg bg-blue-100 py-1.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-200 flex items-center justify-center gap-1">
            <RefreshCw className="h-3 w-3" /> {pendingGpsRef.current} pending GPS points — restore from local store
          </button>
        </div>
      )}

      {activeTrip && (
        <div className="mx-3 mt-3 overflow-hidden rounded-xl bg-white shadow dark:bg-gray-900">
          <div className="bg-green-500 px-4 py-2 text-xs font-medium text-white flex items-center gap-2">
            <Navigation className="h-3 w-3" /> Active delivery
            <span className="ml-auto font-mono">{activeTrip.distanceMeters ? `${(activeTrip.distanceMeters / 1000).toFixed(1)} km` : ""}</span>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs dark:bg-green-900">📍</div>
                <div className="h-6 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs dark:bg-red-900">🏁</div>
              </div>
              <div className="flex-1 text-xs">
                <div className="mb-2"><div className="font-medium">Pickup</div><div className="text-muted-foreground">{activeTrip.pickup.address || `${activeTrip.pickup.lat.toFixed(4)}, ${activeTrip.pickup.lng.toFixed(4)}`}</div></div>
                <div><div className="font-medium">Dropoff</div><div className="text-muted-foreground">{activeTrip.dropoff.address || `${activeTrip.dropoff.lat.toFixed(4)}, ${activeTrip.dropoff.lng.toFixed(4)}`}</div></div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 rounded-lg bg-green-500 py-2.5 text-xs font-medium text-white flex items-center justify-center gap-1" onClick={() => updateTripStatus(activeTrip.id, "completed")}>
                <CheckCircle className="h-4 w-4" /> Delivered
              </button>
              <button className="rounded-lg bg-red-500 px-4 py-2.5 text-xs font-medium text-white" onClick={() => updateTripStatus(activeTrip.id, "cancelled")}>
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-3 mt-3">
        <button
          onClick={tracking ? stopTracking : startTracking}
          className={cn("w-full rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all", tracking ? "bg-red-500 text-white" : "bg-primary text-primary-foreground")}
        >
          <Crosshair className={cn("h-4 w-4", tracking && "animate-pulse")} />
          {tracking ? "Stop location sharing" : "Start location sharing"}
        </button>
        {gpsError && <p className="mt-1 text-center text-[10px] text-red-500">{gpsError}</p>}
        {pos && tracking && (
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            {pos.coords.latitude.toFixed(5)}, {pos.coords.longitude.toFixed(5)}{pos.coords.speed != null && ` · ${Math.round(pos.coords.speed * 3.6)} km/h`}
          </p>
        )}
      </div>

      <div className="mx-3 mt-4 flex-1">
        <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">My trips ({myTrips.length})</h2>
        <div className="space-y-2 pb-4">
          {myTrips.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">No trips assigned yet. Start location sharing and wait for dispatches.</p>
          )}
          {myTrips.map((t) => (
            <div key={t.id} className="rounded-xl bg-white p-3 shadow dark:bg-gray-900">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", t.status === "active" ? "bg-green-500" : t.status === "completed" ? "bg-blue-500" : t.status === "cancelled" ? "bg-red-400" : "bg-yellow-500")} />
                  <span className="capitalize font-medium">{t.status}</span>
                </div>
                {t.distanceMeters != null && <span className="text-muted-foreground">{(t.distanceMeters / 1000).toFixed(1)} km</span>}
              </div>
              <div className="mt-1.5 flex items-start gap-2 text-xs">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                <span className="text-muted-foreground truncate">{t.pickup.address || `${t.pickup.lat.toFixed(4)}, ${t.pickup.lng.toFixed(4)}`}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                <span className="text-muted-foreground truncate">{t.dropoff.address || `${t.dropoff.lat.toFixed(4)}, ${t.dropoff.lng.toFixed(4)}`}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                {new Date(t.createdAt).toLocaleString()}
              </div>
              {t.status === "pending" && (
                <button className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground flex items-center justify-center gap-1" onClick={() => acceptTrip(t.id)}>
                  <Play className="h-3 w-3" /> Accept delivery
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {offline && (
        <div className="sticky bottom-0 mx-3 mb-3 rounded-xl bg-yellow-100 p-3 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          Offline — GPS &amp; trip data stored locally via Y.js CRDT — syncs automatically when online
        </div>
      )}

      {!swReady && (
        <div className="mx-3 mb-3 rounded-xl bg-blue-100 p-2 text-center text-[10px] text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Installing offline support…
        </div>
      )}
        </div>
      </div>
    </ConsoleShell>
  );
}
