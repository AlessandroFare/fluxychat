import { pickRouteDeps } from "./route-http-deps.js";
import {
  parseGpsIngestBody,
  parseVehicleInput,
  parseTripInput,
  parseGeofenceInput,
  parseDeliveryMatchInput,
  ingestGps,
  listCurrentPositions,
  getGpsHistory,
  listVehicles,
  createVehicle,
  updateVehicle,
  listTrips,
  createTrip,
  updateTripStatus,
  listGeofences,
  createGeofence,
  findNearestDrivers,
  matchDelivery,
  routeCopilot,
  predictDeliveryWindow,
  dynamicPricing,
} from "../lib/fleet-tracking.js";

export async function dispatchFleetTrackingRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError",
  ]);

  if (!url.pathname.startsWith("/fleet")) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const projectId = auth.projectId;

  try {
    /* ── POST /fleet/gps (ingest) ── */
    if (url.pathname === "/fleet/gps" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const parsed = parseGpsIngestBody(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
      const result = await ingestGps(env, projectId, parsed.data);
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/gps/current ── */
    if (url.pathname === "/fleet/gps/current" && request.method === "GET") {
      const result = await listCurrentPositions(env, projectId);
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/gps/history ── */
    if (url.pathname === "/fleet/gps/history" && request.method === "GET") {
      const vehicleId = url.searchParams.get("vehicleId");
      const from = Number(url.searchParams.get("from")) || Date.now() - 3600000;
      const to = Number(url.searchParams.get("to")) || Date.now();
      if (!vehicleId) return json({ error: "vehicleId query param required" }, { status: 400 });
      const result = await getGpsHistory(env, projectId, vehicleId, from, to);
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/vehicles ── */
    if (url.pathname === "/fleet/vehicles" && request.method === "GET") {
      const result = await listVehicles(env, projectId);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/vehicles ── */
    if (url.pathname === "/fleet/vehicles" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const parsed = parseVehicleInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
      const result = await createVehicle(env, projectId, parsed.data);
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── PATCH /fleet/vehicles/:id ── */
    const vehiclePatchMatch = url.pathname.match(/^\/fleet\/vehicles\/([^/]+)$/);
    if (vehiclePatchMatch && request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "body required" }, { status: 400 });
      const result = await updateVehicle(env, projectId, vehiclePatchMatch[1], body);
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/trips ── */
    if (url.pathname === "/fleet/trips" && request.method === "GET") {
      const statusFilter = url.searchParams.get("status") || null;
      const result = await listTrips(env, projectId, statusFilter);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/trips ── */
    if (url.pathname === "/fleet/trips" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const parsed = parseTripInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
      const result = await createTrip(env, projectId, parsed.data);
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── PATCH /fleet/trips/:id ── */
    const tripPatchMatch = url.pathname.match(/^\/fleet\/trips\/([^/]+)$/);
    if (tripPatchMatch && request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const status = body?.status;
      if (!status || !["active", "completed", "cancelled"].includes(status)) {
        return json({ error: "valid status required (active|completed|cancelled)" }, { status: 400 });
      }
      const result = await updateTripStatus(env, projectId, tripPatchMatch[1], status);
      if (!result.ok) {
        const st = result.status || 400;
        return json(result, { status: st, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/geofences ── */
    if (url.pathname === "/fleet/geofences" && request.method === "GET") {
      const result = await listGeofences(env, projectId);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/geofences ── */
    if (url.pathname === "/fleet/geofences" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const parsed = parseGeofenceInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
      const result = await createGeofence(env, projectId, parsed.data);
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── POST /fleet/delivery/nearest ── */
    if (url.pathname === "/fleet/delivery/nearest" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const lat = Number(body?.lat);
      const lng = Number(body?.lng);
      if (!isFinite(lat) || !isFinite(lng)) return json({ error: "lat/lng required" }, { status: 400 });
      const result = await findNearestDrivers(env, projectId, lat, lng, Number(body?.limit) || 5);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/delivery/match ── */
    if (url.pathname === "/fleet/delivery/match" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const parsed = parseDeliveryMatchInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });
      const result = await matchDelivery(env, projectId,
        parsed.data.pickupLat, parsed.data.pickupLng,
        parsed.data.dropoffLat, parsed.data.dropoffLng,
        parsed.data.pickupAddress, parsed.data.dropoffAddress,
      );
      if (!result.ok) return json(result, { status: result.error === "no_available_drivers" ? 404 : 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── POST /fleet/route/copilot ── */
    if (url.pathname === "/fleet/route/copilot" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const pickupLat = Number(body?.pickupLat);
      const pickupLng = Number(body?.pickupLng);
      const dropoffLat = Number(body?.dropoffLat);
      const dropoffLng = Number(body?.dropoffLng);
      if (!isFinite(pickupLat) || !isFinite(dropoffLat)) return json({ error: "pickup/dropoff lat/lng required" }, { status: 400 });
      const result = await routeCopilot(env, projectId, pickupLat, pickupLng, dropoffLat, dropoffLng);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/delivery/predict ── */
    if (url.pathname === "/fleet/delivery/predict" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const pickupLat = Number(body?.pickupLat);
      const pickupLng = Number(body?.pickupLng);
      const dropoffLat = Number(body?.dropoffLat);
      const dropoffLng = Number(body?.dropoffLng);
      if (!isFinite(pickupLat) || !isFinite(dropoffLat)) return json({ error: "pickup/dropoff lat/lng required" }, { status: 400 });
      const result = await predictDeliveryWindow(env, projectId, pickupLat, pickupLng, dropoffLat, dropoffLng);
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /fleet/pricing ── */
    if (url.pathname === "/fleet/pricing" && request.method === "POST") {
      const result = await dynamicPricing(env, projectId);
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("fleet.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
