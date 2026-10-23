import type { FluxyChatClient } from "./index";

export interface FleetVehicle {
  id: string;
  name: string;
  plate: string | null;
  driverId?: string | null;
  status: string;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  lastSeenAt?: string | null;
  createdAt?: string;
}

export interface FleetPosition {
  id: string;
  name: string;
  plate: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  lastSeenAt: string | null;
}

export interface FleetGpsPoint {
  ts: number;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
}

export interface FleetTrip {
  id: string;
  vehicleId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  driverId: string | null;
  pickup: { lat: number; lng: number; address: string | null };
  dropoff: { lat: number; lng: number; address: string | null };
  distanceMeters: number | null;
  createdAt: string;
}

export interface FleetGeofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: string;
}

export interface FleetGeofenceEvent {
  id: string;
  geofenceId: string;
  vehicleId: string;
  eventType: string;
  occurredAt: string;
}

export interface FleetDriver {
  id: string;
  name: string;
  plate: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  lastSeenAt: string | null;
  distanceMeters: number;
}

export interface FleetCopilotPlan {
  distanceMeters: number;
  baseDurationMin: number;
  trafficFactor: number;
  weather: string;
  weatherFactor: number;
  estimatedDurationMin: number;
  alternatives: Array<{ label: string; durationMin: number; traffic: string; note: string | null }>;
  advice: string;
  timestamp: string;
}

export interface FleetDeliveryWindow {
  distanceKm: number;
  estimatedMinutes: number;
  windowLowMinutes: number;
  windowHighMinutes: number;
  windowLow: string;
  windowHigh: string;
  confidencePercent: number;
  sampleSize: number;
  factors: { peakHour: boolean; averageSpeedKmph: number };
}

export interface FleetPricing {
  basePrice: number;
  surgeMultiplier: number;
  surgePrice: number;
  surgeLabel: string;
  activeTrips: number;
  availableDrivers: number;
  demandRatio: number;
  currency: string;
}

/** OwnTracks-compatible location JSON (`_type: "location"`), plus `vehicleId`/`roomId`. */
export interface FleetGpsIngestBody {
  vehicleId?: string;
  lat: number;
  lng?: number;
  lon?: number;
  _type?: "location";
  tid?: string;
  tst?: number;
  acc?: number;
  vel?: number;
  cog?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  batt?: number;
  roomId?: string;
}

export interface FleetGpsIngestResult {
  ok: boolean;
  ts?: number;
  geofenceEvents?: FleetGeofenceEvent[];
  count?: number;
  results?: FleetGpsIngestResult[];
}

export interface WorkerFluxyFleetClient {
  /**
   * Ingest one location or a batch. Pass `vehicleKey` (`fleet_…`) on a device:
   * a vehicle key only works on this route and the Worker forces its own vehicleId.
   */
  ingestGps(
    body: FleetGpsIngestBody | FleetGpsIngestBody[],
    opts?: { vehicleKey?: string; limit?: { user?: string; device?: string } },
  ): Promise<FleetGpsIngestResult>;
  listCurrentPositions(filter?: { vehicleId?: string }): Promise<FleetPosition[]>;
  /** `from`/`to`: unix ms, unix seconds or ISO date. Defaults to the last hour. */
  listGpsHistory(
    vehicleId: string,
    filter?: { from?: string | number; to?: string | number; limit?: number },
  ): Promise<FleetGpsPoint[]>;
  listVehicles(): Promise<FleetVehicle[]>;
  createVehicle(input: {
    name: string;
    plate?: string;
    driverId?: string;
  }): Promise<{ vehicle: FleetVehicle; apiKey: string }>;
  updateVehicle(
    vehicleId: string,
    patch: { name?: string; plate?: string; driverId?: string; status?: string },
  ): Promise<{ ok: boolean }>;
  listTrips(filter?: { status?: string }): Promise<FleetTrip[]>;
  createTrip(input: {
    vehicleId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
  }): Promise<FleetTrip>;
  updateTripStatus(
    tripId: string,
    status: "active" | "completed" | "cancelled",
  ): Promise<{ ok: boolean; status: string }>;
  listGeofences(): Promise<FleetGeofence[]>;
  createGeofence(input: {
    name: string;
    lat: number;
    lng: number;
    radiusMeters?: number;
  }): Promise<FleetGeofence>;
  updateGeofence(
    geofenceId: string,
    patch: { name?: string; lat?: number; lng?: number; radiusMeters?: number },
  ): Promise<{ ok: boolean }>;
  deleteGeofence(geofenceId: string): Promise<{ ok: boolean }>;
  listGeofenceEvents(filters?: {
    vehicleId?: string;
    geofenceId?: string;
    limit?: number;
  }): Promise<FleetGeofenceEvent[]>;
  findNearestDrivers(lat: number, lng: number, limit?: number): Promise<FleetDriver[]>;
  matchDelivery(input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
  }): Promise<{
    trip: FleetTrip;
    driver: { id: string; name: string; plate: string | null; etaMinutes: number; distanceMeters: number };
  }>;
  routeCopilot(input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }): Promise<FleetCopilotPlan>;
  predictDeliveryWindow(input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }): Promise<FleetDeliveryWindow>;
  dynamicPricing(): Promise<FleetPricing>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

export function createWorkerFluxyFleetClient(client: FluxyChatClient): WorkerFluxyFleetClient {
  return {
    async ingestGps(body, opts) {
      const auth = opts?.vehicleKey
        ? { Authorization: `Bearer ${opts.vehicleKey}` }
        : await headers(client);
      const limitHeaders: Record<string, string> = {};
      if (opts?.limit?.user) limitHeaders["X-Limit-User"] = opts.limit.user;
      if (opts?.limit?.device) limitHeaders["X-Limit-Device"] = opts.limit.device;
      const res = await fetch(`${base(client)}/fleet/gps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth, ...limitHeaders },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`ingestGps failed: ${res.status}`);
      return (await res.json()) as FleetGpsIngestResult;
    },

    async listCurrentPositions(filter) {
      const url = new URL(`${base(client)}/fleet/gps/current`);
      if (filter?.vehicleId) url.searchParams.set("vehicleId", filter.vehicleId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listCurrentPositions failed: ${res.status}`);
      const body = (await res.json()) as { vehicles: FleetPosition[] };
      return body.vehicles ?? [];
    },

    async listGpsHistory(vehicleId, filter) {
      const url = new URL(`${base(client)}/fleet/gps/history`);
      url.searchParams.set("vehicleId", vehicleId);
      if (filter?.from != null) url.searchParams.set("from", String(filter.from));
      if (filter?.to != null) url.searchParams.set("to", String(filter.to));
      if (filter?.limit) url.searchParams.set("limit", String(filter.limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listGpsHistory failed: ${res.status}`);
      const body = (await res.json()) as { points: FleetGpsPoint[] };
      return body.points ?? [];
    },

    async listVehicles() {
      const res = await fetch(`${base(client)}/fleet/vehicles`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`listVehicles failed: ${res.status}`);
      const body = (await res.json()) as { vehicles: FleetVehicle[] };
      return body.vehicles ?? [];
    },

    async createVehicle(input) {
      const res = await fetch(`${base(client)}/fleet/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createVehicle failed: ${res.status}`);
      return (await res.json()) as { vehicle: FleetVehicle; apiKey: string };
    },

    async updateVehicle(vehicleId, patch) {
      const res = await fetch(`${base(client)}/fleet/vehicles/${encodeURIComponent(vehicleId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`updateVehicle failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },

    async listTrips(filter) {
      const url = new URL(`${base(client)}/fleet/trips`);
      if (filter?.status) url.searchParams.set("status", filter.status);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listTrips failed: ${res.status}`);
      const body = (await res.json()) as { trips: FleetTrip[] };
      return body.trips ?? [];
    },

    async createTrip(input) {
      const res = await fetch(`${base(client)}/fleet/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createTrip failed: ${res.status}`);
      const body = (await res.json()) as { trip: FleetTrip };
      return body.trip;
    },

    async updateTripStatus(tripId, status) {
      const res = await fetch(`${base(client)}/fleet/trips/${encodeURIComponent(tripId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`updateTripStatus failed: ${res.status}`);
      return (await res.json()) as { ok: boolean; status: string };
    },

    async listGeofences() {
      const res = await fetch(`${base(client)}/fleet/geofences`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`listGeofences failed: ${res.status}`);
      const body = (await res.json()) as { geofences: FleetGeofence[] };
      return body.geofences ?? [];
    },

    async createGeofence(input) {
      const res = await fetch(`${base(client)}/fleet/geofences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createGeofence failed: ${res.status}`);
      const body = (await res.json()) as { geofence: FleetGeofence };
      return body.geofence;
    },

    async updateGeofence(geofenceId, patch) {
      const res = await fetch(`${base(client)}/fleet/geofences/${encodeURIComponent(geofenceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`updateGeofence failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },

    async deleteGeofence(geofenceId) {
      const res = await fetch(`${base(client)}/fleet/geofences/${encodeURIComponent(geofenceId)}`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`deleteGeofence failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },

    async listGeofenceEvents(filters) {
      const url = new URL(`${base(client)}/fleet/geofence-events`);
      if (filters?.vehicleId) url.searchParams.set("vehicleId", filters.vehicleId);
      if (filters?.geofenceId) url.searchParams.set("geofenceId", filters.geofenceId);
      if (filters?.limit) url.searchParams.set("limit", String(filters.limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listGeofenceEvents failed: ${res.status}`);
      const body = (await res.json()) as { events: FleetGeofenceEvent[] };
      return body.events ?? [];
    },

    async findNearestDrivers(lat, lng, limit) {
      const res = await fetch(`${base(client)}/fleet/delivery/nearest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ lat, lng, limit }),
      });
      if (!res.ok) throw new Error(`findNearestDrivers failed: ${res.status}`);
      const body = (await res.json()) as { drivers: FleetDriver[] };
      return body.drivers ?? [];
    },

    async matchDelivery(input) {
      const res = await fetch(`${base(client)}/fleet/delivery/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`matchDelivery failed: ${res.status}`);
      return (await res.json()) as {
        trip: FleetTrip;
        driver: { id: string; name: string; plate: string | null; etaMinutes: number; distanceMeters: number };
      };
    },

    async routeCopilot(input) {
      const res = await fetch(`${base(client)}/fleet/route/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`routeCopilot failed: ${res.status}`);
      const body = (await res.json()) as { copilot: FleetCopilotPlan };
      return body.copilot;
    },

    async predictDeliveryWindow(input) {
      const res = await fetch(`${base(client)}/fleet/delivery/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`predictDeliveryWindow failed: ${res.status}`);
      const body = (await res.json()) as { window: FleetDeliveryWindow };
      return body.window;
    },

    async dynamicPricing() {
      const res = await fetch(`${base(client)}/fleet/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
      });
      if (!res.ok) throw new Error(`dynamicPricing failed: ${res.status}`);
      const body = (await res.json()) as { pricing: FleetPricing };
      return body.pricing;
    },
  };
}
