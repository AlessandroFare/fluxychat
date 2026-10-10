import { pickRouteDeps } from "./route-http-deps.js";
import { readDeviceBearer } from "../lib/device-secret.js";
import {
  parseGpsIngestBody,
  parseRecorderTime,
  parseVehicleInput,
  parseTripInput,
  parseGeofenceInput,
  parseGeofencePatch,
  parseDeliveryMatchInput,
  authenticateFleetVehicle,
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
  updateGeofence,
  deleteGeofence,
  listGeofenceEvents,
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

  const deviceKey = readDeviceBearer(request);
  let auth = null;
  if (deviceKey.startsWith("fleet_")) {
    auth = await authenticateFleetVehicle(env, deviceKey);
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (url.pathname !== "/fleet/gps" || request.method !== "POST") {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
  } else {
    auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
  }
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const projectId = auth.projectId;

  try {
    /* ── POST /fleet/gps (ingest; OwnTracks location JSON or array) ── */
    if (url.pathname === "/fleet/gps" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const limit = {
        user: request.headers.get("X-Limit-User") || undefined,
        device: request.headers.get("X-Limit-Device") || undefined,
      };
      const items = Array.isArray(body) ? body : [body];
      const ingested = [];
      for (const item of items) {
        const parsed = parseGpsIngestBody(item, limit);
        if (!parsed.ok) {
          if (parsed.error === "skip_type") continue;
          return json({ error: parsed.error }, { status: 400 });
        }
        if (auth.id) parsed.data.vehicleId = auth.id;
        const result = await ingestGps(env, projectId, parsed.data);
        if (result.error === "quota_exceeded") {
          return json(result, { status: 429, headers: corsHeaders });
        }
        ingested.push(result);
      }
      if (!ingested.length) return json({ error: "no_location" }, { status: 400 });
      return json(ingested.length === 1 ? ingested[0] : { ok: true, count: ingested.length, results: ingested }, {
        headers: corsHeaders,
      });
    }

    /* ── GET /fleet/gps/current | /fleet/gps/last (recorder last) ── */
    if ((url.pathname === "/fleet/gps/current" || url.pathname === "/fleet/gps/last") && request.method === "GET") {
      const vehicleId = url.searchParams.get("vehicleId") || url.searchParams.get("device");
      const result = await listCurrentPositions(env, projectId, vehicleId);
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/gps/history | /fleet/gps/locations (recorder locations) ── */
    if ((url.pathname === "/fleet/gps/history" || url.pathname === "/fleet/gps/locations") && request.method === "GET") {
      const vehicleId = url.searchParams.get("vehicleId") || url.searchParams.get("device");
      const from = parseRecorderTime(
        url.searchParams.get("from") || request.headers.get("X-Limit-From"),
        Date.now() - 3600000,
      );
      const to = parseRecorderTime(
        url.searchParams.get("to") || request.headers.get("X-Limit-To"),
        Date.now(),
      );
      const limit = url.searchParams.get("limit");
      if (!vehicleId) return json({ error: "vehicleId query param required" }, { status: 400 });
      const result = await getGpsHistory(env, projectId, vehicleId, from, to, limit);
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

    /* ── PATCH /fleet/geofences/:id ── */
    const geofenceMatch = url.pathname.match(/^\/fleet\/geofences\/([^/]+)$/);
    if (geofenceMatch && request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const parsed = parseGeofencePatch(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers: corsHeaders });
      const result = await updateGeofence(env, projectId, geofenceMatch[1], parsed.data);
      if (!result.ok) return json(result, { status: result.status || 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (geofenceMatch && request.method === "DELETE") {
      const result = await deleteGeofence(env, projectId, geofenceMatch[1]);
      if (!result.ok) return json(result, { status: result.status || 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /fleet/geofence-events ── */
    if (url.pathname === "/fleet/geofence-events" && request.method === "GET") {
      const result = await listGeofenceEvents(env, projectId, {
        vehicleId: url.searchParams.get("vehicleId") || null,
        geofenceId: url.searchParams.get("geofenceId") || null,
        limit: url.searchParams.get("limit"),
      });
      return json(result, { headers: corsHeaders });
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
