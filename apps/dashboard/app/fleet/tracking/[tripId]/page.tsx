"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Truck, MapPin, Send, Navigation, Bot, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../../../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import { RouteCopilotPanel } from "@/components/fleet/route-copilot";
import { DeliveryWindow } from "@/components/fleet/delivery-window";
import { DynamicPricing } from "@/components/fleet/dynamic-pricing";
import { ARNavigation } from "@/components/fleet/ar-navigation";

const DeliveryMap = dynamic(() => import("@/components/fleet/delivery-map").then((m) => m.DeliveryMap), { ssr: false });

const WORKER_URL = getPublicWorkerUrl();

interface TripDetail { id: string; vehicleId: string; status: string; startedAt: string | null; completedAt: string | null; pickup: { lat: number; lng: number; address: string | null }; dropoff: { lat: number; lng: number; address: string | null }; distanceMeters: number | null; createdAt: string; }
interface VehiclePos { lat: number; lng: number; heading: number | null; speed: number | null; }

export default function TrackingPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [vehiclePos, setVehiclePos] = useState<VehiclePos | null>(null);
  const [vehicleName, setVehicleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<{ id: string; text: string; sender: string; createdAt: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [distanceLeft, setDistanceLeft] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [copilot, setCopilot] = useState<any>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [windowData, setWindowData] = useState<any>(null);
  const [windowLoading, setWindowLoading] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({ baseUrl: WORKER_URL, userId: "console", token });
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!client) return;
    try {
      const [tripsRes, vehiclesRes] = await Promise.all([client.listFleetTrips(), client.listFleetVehicles()]);
      const found = tripsRes.trips.find((t) => t.id === tripId) as TripDetail | undefined;
      if (found) setTrip(found);
      if (found) {
        const v = vehiclesRes.vehicles.find((ve) => ve.id === found.vehicleId);
        if (v) {
          setVehicleName(v.name);
          if (v.lat != null && v.lng != null) {
            setVehiclePos({ lat: v.lat, lng: v.lng, heading: (v as any).heading ?? null, speed: v.speed });
            if (v.speed != null && found.distanceMeters) {
              const remaining = Math.max(0, found.distanceMeters - v.speed * 10);
              setDistanceLeft(remaining);
            }
          }
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [client, tripId]);

  const loadCopilot = useCallback(async () => {
    if (!client || !trip) return;
    setCopilotLoading(true);
    try {
      const r = await client.routeCopilot({ pickupLat: trip.pickup.lat, pickupLng: trip.pickup.lng, dropoffLat: trip.dropoff.lat, dropoffLng: trip.dropoff.lng });
      setCopilot(r.copilot);
    } catch { /* ignore */ }
    setCopilotLoading(false);
  }, [client, trip]);

  const loadWindow = useCallback(async () => {
    if (!client || !trip) return;
    setWindowLoading(true);
    try {
      const r = await client.predictDeliveryWindow({ pickupLat: trip.pickup.lat, pickupLng: trip.pickup.lng, dropoffLat: trip.dropoff.lat, dropoffLng: trip.dropoff.lng });
      setWindowData(r.window);
    } catch { /* ignore */ }
    setWindowLoading(false);
  }, [client, trip]);

  const loadPricing = useCallback(async () => {
    if (!client) return;
    setPricingLoading(true);
    try {
      const r = await client.getDynamicPricing();
      setPricing(r.pricing);
    } catch { /* ignore */ }
    setPricingLoading(false);
  }, [client]);

  useEffect(() => { loadAll(); const iv = setInterval(loadAll, 5000); return () => clearInterval(iv); }, [loadAll]);
  useEffect(() => { if (trip) { loadCopilot(); loadWindow(); } }, [trip, loadCopilot, loadWindow]);
  useEffect(() => { loadPricing(); }, [loadPricing]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const progress = trip ? (trip.status === "completed" ? 100 : trip.status === "active" ? 50 : 0) : 0;

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!trip) return <div className="flex h-screen flex-col items-center justify-center gap-3"><Truck className="h-12 w-12 text-muted-foreground" /><p className="text-lg font-medium">Trip not found</p><Link href="/fleet" className="text-sm text-primary hover:underline">Back to fleet</Link></div>;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <Link href="/fleet" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Delivery #{tripId.slice(0, 8)}</h1>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" />{trip.pickup.address || `${trip.pickup.lat.toFixed(4)}, ${trip.pickup.lng.toFixed(4)}`} &rarr; {trip.dropoff.address || `${trip.dropoff.lat.toFixed(4)}, ${trip.dropoff.lng.toFixed(4)}`}
          </div>
        </div>
        <div className="w-48"><DeliveryWindow data={windowData} loading={windowLoading} /></div>
      </header>

      <div className="h-0.5 w-full bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>

      <div className="flex flex-1 flex-col md:flex-row">
        <div className="relative flex-1 flex flex-col min-h-[40vh] md:min-h-0">
          <div className="flex-1 relative">
            <DeliveryMap pickup={trip.pickup} dropoff={trip.dropoff} vehiclePos={vehiclePos} status={trip.status} />
            <div className="absolute left-2 top-2 right-2 z-[1000] rounded-xl bg-background/80 p-2 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"><Truck className="h-4 w-4 text-primary" /></div>
                <div className="flex-1">
                  <div className="font-medium text-xs">{vehicleName}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Navigation className="h-3 w-3" />{distanceLeft != null ? `${(distanceLeft / 1000).toFixed(1)} km away` : "Connecting..."}</div>
                </div>
                {vehiclePos?.speed != null && <div className="text-right"><div className="font-mono text-xs font-bold">{Math.round(vehiclePos.speed * 3.6)}</div><div className="text-[9px] text-muted-foreground">km/h</div></div>}
                <button onClick={() => setShowCopilot(!showCopilot)} className="rounded-full bg-indigo-100 p-1.5 dark:bg-indigo-900"><Bot className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" /></button>
              </div>
              {showCopilot && <div className="mt-2"><RouteCopilotPanel copilot={copilot} loading={copilotLoading} /></div>}
            </div>
          </div>
          <div className="border-t p-2"><ARNavigation vehicleHeading={vehiclePos?.heading ?? null} destinationLat={trip.dropoff.lat} destinationLng={trip.dropoff.lng} vehicleLat={vehiclePos?.lat ?? trip.pickup.lat} vehicleLng={vehiclePos?.lng ?? trip.pickup.lng} destinationLabel={trip.dropoff.address || "Dropoff"} /></div>
        </div>

        <div className="flex w-full flex-col border-t md:w-80 md:border-l md:border-t-0">
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <div className="flex-1 text-[10px] font-medium text-muted-foreground">Delivery Chat</div>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", trip.status === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : trip.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200")}>
              {trip.status === "pending" ? "Waiting" : trip.status === "active" ? "En route" : "Delivered"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.sender === "me" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs", m.sender === "me" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <div>{m.text}</div>
                  <div className={cn("mt-0.5 text-[9px]", m.sender === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-2">
            <div className="flex gap-1.5">
              <input className="flex-1 rounded-full border bg-muted px-3 py-1.5 text-xs outline-none focus:border-primary" placeholder="Message driver..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && inputText.trim()) { setMessages((prev) => [...prev, { id: Date.now().toString(), text: inputText, sender: "me", createdAt: new Date().toISOString() }]); setInputText(""); } }} />
              <button className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" disabled={!inputText.trim()} onClick={() => { if (inputText.trim()) { setMessages((prev) => [...prev, { id: Date.now().toString(), text: inputText, sender: "me", createdAt: new Date().toISOString() }]); setInputText(""); } }}><Send className="h-3 w-3" /></button>
            </div>
          </div>

          <div className="border-t p-2 space-y-1.5"><DynamicPricing data={pricing} loading={pricingLoading} /></div>
        </div>
      </div>
    </div>
  );
}
