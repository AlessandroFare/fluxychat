const GPS_RAW_TTL_SEC = 7 * 86400;
const AGG_INTERVAL_SEC = 300;

function generateId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function toBucket(ts) {
  return Math.floor(new Date(ts).getTime() / 1000 / AGG_INTERVAL_SEC) * AGG_INTERVAL_SEC;
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointInGeofence(lat, lng, centerLat, centerLng, radiusMeters) {
  return haversine(lat, lng, centerLat, centerLng) <= radiusMeters;
}

export function parseGpsIngestBody(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const vehicleId = String(body.vehicleId ?? "").trim();
  if (!vehicleId) return { ok: false, error: "vehicleId required" };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) return { ok: false, error: "invalid lat/lng" };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, error: "lat/lng out of range" };
  return {
    ok: true,
    data: {
      vehicleId,
      lat,
      lng,
      speed: body.speed != null ? Number(body.speed) : null,
      heading: body.heading != null ? Number(body.heading) : null,
      accuracy: body.accuracy != null ? Number(body.accuracy) : null,
    },
  };
}

export function parseVehicleInput(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 100) return { ok: false, error: "name required (max 100 chars)" };
  return {
    ok: true,
    data: {
      name,
      plate: body.plate ? String(body.plate).trim() : null,
      driverId: body.driverId ? String(body.driverId).trim() : null,
    },
  };
}

export function parseTripInput(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const vehicleId = String(body.vehicleId ?? "").trim();
  if (!vehicleId) return { ok: false, error: "vehicleId required" };
  const pickupLat = Number(body.pickupLat);
  const pickupLng = Number(body.pickupLng);
  if (!isFinite(pickupLat) || !isFinite(pickupLng)) return { ok: false, error: "invalid pickup coordinates" };
  const dropoffLat = Number(body.dropoffLat);
  const dropoffLng = Number(body.dropoffLng);
  if (!isFinite(dropoffLat) || !isFinite(dropoffLng)) return { ok: false, error: "invalid dropoff coordinates" };
  return { ok: true, data: { vehicleId, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress } };
}

export function parseGeofenceInput(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 100) return { ok: false, error: "name required (max 100 chars)" };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) return { ok: false, error: "invalid lat/lng" };
  const radiusMeters = Number(body.radiusMeters) || 100;
  return { ok: true, data: { name, lat, lng, radiusMeters } };
}

export async function ingestGps(env, projectId, data) {
  const ts = Date.now();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO gps_raw (vehicle_id, fleet_id, timestamp, lat, lng, speed, heading, accuracy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(data.vehicleId, projectId, ts, data.lat, data.lng, data.speed, data.heading, data.accuracy).run();
  await env.DB.prepare(
    `UPDATE fleet_vehicles SET status = 'online', last_lat = ?, last_lng = ?, last_heading = ?, last_speed = ?, last_seen_at = ?
     WHERE id = ? AND fleet_id = ?`,
  ).bind(data.lat, data.lng, data.heading, data.speed, nowISO(), data.vehicleId, projectId).run();
  const aggBucket = toBucket(ts);
  await env.DB.prepare(
    `INSERT INTO gps_aggregated_5min (fleet_id, vehicle_id, bucket, avg_lat, avg_lng, max_speed, distance_meters, point_count)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1)
     ON CONFLICT(fleet_id, vehicle_id, bucket) DO UPDATE SET
       avg_lat = (avg_lat * point_count + ?) / (point_count + 1),
       avg_lng = (avg_lng * point_count + ?) / (point_count + 1),
       max_speed = MAX(max_speed, ?),
       point_count = point_count + 1`,
  ).bind(projectId, data.vehicleId, aggBucket, data.lat, data.lng, data.speed ?? 0, data.lat, data.lng, data.speed ?? 0).run();
  const geofences = await env.DB.prepare(
    `SELECT id, name, lat, lng, radius_meters FROM fleet_geofences WHERE fleet_id = ?`,
  ).bind(projectId).all();
  const events = [];
  for (const gf of geofences.results || []) {
    if (pointInGeofence(data.lat, data.lng, gf.lat, gf.lng, gf.radius_meters)) {
      const eid = generateId("gfe_");
      await env.DB.prepare(
        `INSERT OR IGNORE INTO fleet_geofence_events (id, fleet_id, geofence_id, vehicle_id, event_type, occurred_at)
         VALUES (?, ?, ?, ?, 'enter', ?)`,
      ).bind(eid, projectId, gf.id, data.vehicleId, nowISO()).run();
      events.push({ id: eid, geofenceId: gf.id, vehicleId: data.vehicleId, eventType: "enter" });
    }
  }
  return { ok: true, ts, geofenceEvents: events };
}

export async function listCurrentPositions(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT id, name, plate, status, last_lat, last_lng, last_heading, last_speed, last_seen_at
     FROM fleet_vehicles WHERE fleet_id = ? AND status = 'online'
     ORDER BY name ASC`,
  ).bind(projectId).all();
  return {
    ok: true,
    vehicles: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      plate: r.plate,
      status: r.status,
      lat: r.last_lat,
      lng: r.last_lng,
      heading: r.last_heading,
      speed: r.last_speed,
      lastSeenAt: r.last_seen_at,
    })),
  };
}

export async function getGpsHistory(env, projectId, vehicleId, fromTs, toTs) {
  const rows = await env.DB.prepare(
    `SELECT timestamp, lat, lng, speed, heading
     FROM gps_raw
     WHERE vehicle_id = ? AND fleet_id = ? AND timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC LIMIT 10000`,
  ).bind(vehicleId, projectId, fromTs, toTs).all();
  return {
    ok: true,
    points: (rows.results || []).map((r) => ({
      ts: r.timestamp,
      lat: r.lat,
      lng: r.lng,
      speed: r.speed,
      heading: r.heading,
    })),
  };
}

export async function listVehicles(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT id, name, plate, driver_id, status, last_lat, last_lng, last_speed, last_seen_at, created_at
     FROM fleet_vehicles WHERE fleet_id = ? ORDER BY name ASC`,
  ).bind(projectId).all();
  return {
    ok: true,
    vehicles: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      plate: r.plate,
      driverId: r.driver_id,
      status: r.status,
      lat: r.last_lat,
      lng: r.last_lng,
      speed: r.last_speed,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
    })),
  };
}

export async function createVehicle(env, projectId, data) {
  const id = generateId("v_");
  await env.DB.prepare(
    `INSERT INTO fleet_vehicles (id, fleet_id, name, plate, driver_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, projectId, data.name, data.plate, data.driverId, nowISO()).run();
  return { ok: true, vehicle: { id, name: data.name, plate: data.plate, driverId: data.driverId, status: "offline" } };
}

export async function updateVehicle(env, projectId, vehicleId, data) {
  const fields = [];
  const values = [];
  if (data.name != null) { fields.push("name = ?"); values.push(data.name); }
  if (data.plate !== undefined) { fields.push("plate = ?"); values.push(data.plate); }
  if (data.driverId !== undefined) { fields.push("driver_id = ?"); values.push(data.driverId); }
  if (data.status != null) { fields.push("status = ?"); values.push(data.status); }
  if (!fields.length) return { ok: false, error: "no fields to update" };
  values.push(vehicleId, projectId);
  await env.DB.prepare(
    `UPDATE fleet_vehicles SET ${fields.join(", ")} WHERE id = ? AND fleet_id = ?`,
  ).bind(...values).run();
  return { ok: true };
}

export async function listTrips(env, projectId, statusFilter) {
  let sql = `SELECT id, vehicle_id, status, started_at, completed_at, driver_id,
                    pickup_lat, pickup_lng, pickup_address,
                    dropoff_lat, dropoff_lng, dropoff_address, distance_meters, created_at
             FROM fleet_trips WHERE fleet_id = ?`;
  const params = [projectId];
  if (statusFilter) { sql += " AND status = ?"; params.push(statusFilter); }
  sql += " ORDER BY created_at DESC LIMIT 100";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    ok: true,
    trips: (rows.results || []).map((r) => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      driverId: r.driver_id,
      pickup: { lat: r.pickup_lat, lng: r.pickup_lng, address: r.pickup_address },
      dropoff: { lat: r.dropoff_lat, lng: r.dropoff_lng, address: r.dropoff_address },
      distanceMeters: r.distance_meters,
      createdAt: r.created_at,
    })),
  };
}

export async function createTrip(env, projectId, data) {
  const id = generateId("t_");
  const dm = haversine(data.pickupLat, data.pickupLng, data.dropoffLat, data.dropoffLng);
  await env.DB.prepare(
    `INSERT INTO fleet_trips (id, fleet_id, vehicle_id, status, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, distance_meters, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, projectId, data.vehicleId, data.pickupLat, data.pickupLng, data.pickupAddress ?? null, data.dropoffLat, data.dropoffLng, data.dropoffAddress ?? null, Math.round(dm), nowISO()).run();
  return { ok: true, trip: { id, vehicleId: data.vehicleId, status: "pending", distanceMeters: Math.round(dm) } };
}

export async function updateTripStatus(env, projectId, tripId, status) {
  const row = await env.DB.prepare(
    `SELECT id, status FROM fleet_trips WHERE id = ? AND fleet_id = ? LIMIT 1`,
  ).bind(tripId, projectId).first();
  if (!row) return { ok: false, error: "trip_not_found", status: 404 };
  const validTransitions = { pending: ["active", "cancelled"], active: ["completed", "cancelled"] };
  if (!validTransitions[row.status]?.includes(status)) {
    return { ok: false, error: `invalid transition from ${row.status} to ${status}` };
  }
  const updates = ["status = ?"];
  const params = [status];
  if (status === "active") { updates.push("started_at = ?"); params.push(nowISO()); }
  if (status === "completed" || status === "cancelled") { updates.push("completed_at = ?"); params.push(nowISO()); }
  params.push(tripId, projectId);
  await env.DB.prepare(`UPDATE fleet_trips SET ${updates.join(", ")} WHERE id = ? AND fleet_id = ?`).bind(...params).run();
  if (status === "completed" || status === "cancelled") {
    await env.DB.prepare(`UPDATE fleet_vehicles SET status = 'idle' WHERE id = (SELECT vehicle_id FROM fleet_trips WHERE id = ?) AND fleet_id = ?`).bind(tripId, projectId).run();
  }
  return { ok: true, status };
}

export async function listGeofences(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT id, name, lat, lng, radius_meters, created_at FROM fleet_geofences WHERE fleet_id = ? ORDER BY name ASC`,
  ).bind(projectId).all();
  return {
    ok: true,
    geofences: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      radiusMeters: r.radius_meters,
      createdAt: r.created_at,
    })),
  };
}

export async function createGeofence(env, projectId, data) {
  const id = generateId("gf_");
  await env.DB.prepare(
    `INSERT INTO fleet_geofences (id, fleet_id, name, lat, lng, radius_meters, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, projectId, data.name, data.lat, data.lng, data.radiusMeters, nowISO()).run();
  return { ok: true, geofence: { id, name: data.name, lat: data.lat, lng: data.lng, radiusMeters: data.radiusMeters } };
}

/* ── Delivery dispatch (crowdsourced matching) ── */

export async function findNearestDrivers(env, projectId, lat, lng, limit = 5) {
  const rows = await env.DB.prepare(
    `SELECT id, name, plate, last_lat, last_lng, last_speed, last_seen_at
     FROM fleet_vehicles
     WHERE fleet_id = ? AND status IN ('online','idle') AND last_lat IS NOT NULL AND last_lng IS NOT NULL
     ORDER BY ABS(last_lat - ?) + ABS(last_lng - ?) ASC
     LIMIT ?`,
  ).bind(projectId, lat, lng, limit).all();
  const drivers = (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    plate: r.plate,
    lat: r.last_lat,
    lng: r.last_lng,
    speed: r.last_speed,
    lastSeenAt: r.last_seen_at,
    distanceMeters: Math.round(haversine(lat, lng, r.last_lat, r.last_lng)),
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { ok: true, drivers };
}

export async function matchDelivery(env, projectId, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress) {
  const nearest = await findNearestDrivers(env, projectId, pickupLat, pickupLng, 1);
  const driver = nearest.drivers[0];
  if (!driver) return { ok: false, error: "no_available_drivers" };
  const tripResult = await createTrip(env, projectId, {
    vehicleId: driver.id, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress,
  });
  if (!tripResult.ok) return tripResult;
  const etaMinutes = Math.round(driver.distanceMeters / 60 / 8.33);
  return {
    ok: true,
    trip: tripResult.trip,
    driver: { id: driver.id, name: driver.name, plate: driver.plate, etaMinutes, distanceMeters: driver.distanceMeters },
  };
}

export function parseDeliveryMatchInput(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const pickupLat = Number(body.pickupLat);
  const pickupLng = Number(body.pickupLng);
  const dropoffLat = Number(body.dropoffLat);
  const dropoffLng = Number(body.dropoffLng);
  if (!isFinite(pickupLat) || !isFinite(pickupLng)) return { ok: false, error: "invalid pickup coordinates" };
  if (!isFinite(dropoffLat) || !isFinite(dropoffLng)) return { ok: false, error: "invalid dropoff coordinates" };
  return {
    ok: true, data: { pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress },
  };
}

/* ── AI Route Copilot ── */

const TRAFFIC_BY_HOUR = [1,1,1,1,1,1.2,1.5,2,2.2,2,1.8,1.5,1.3,1.4,1.6,1.8,2,2.3,2.5,2,1.5,1.3,1.1,1];
const WEATHER_CONDITIONS = ["clear","clear","clear","cloudy","cloudy","rain","rain","storm"];

function getTrafficFactor() {
  return TRAFFIC_BY_HOUR[new Date().getHours()] || 1;
}

function getWeather() {
  return WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
}

function getWeatherFactor(weather) {
  const f = { clear: 1, cloudy: 1.1, rain: 1.3, storm: 1.6 };
  return f[weather] || 1;
}

export async function routeCopilot(env, projectId, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const distMeters = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const traffic = getTrafficFactor();
  const weather = getWeather();
  const weatherF = getWeatherFactor(weather);
  const baseDurationMin = distMeters / 60 / 8.33;
  const trafficDurationMin = baseDurationMin * traffic;
  const actualDurationMin = trafficDurationMin * weatherF;

  const alternatives = [
    {
      label: "Fastest",
      durationMin: Math.round(actualDurationMin * 0.9),
      traffic: "moderate",
      note: traffic > 1.5 ? "Avoid city center" : null,
    },
    {
      label: "Scenic route",
      durationMin: Math.round(actualDurationMin * 1.3),
      traffic: "low",
      note: weather === "clear" ? "Good visibility" : null,
    },
    {
      label: "Highway",
      durationMin: Math.round(actualDurationMin * 1.0),
      traffic: traffic > 1.5 ? "heavy" : "light",
      note: traffic > 2 ? "Expect delays near exit 12" : null,
    },
  ];

  const copilotAdvice = traffic > 1.8
    ? "Heavy traffic detected. Consider the Highway route — slightly longer distance but fewer signals."
    : weatherF > 1.2
    ? `Weather: ${weather}. Reduce speed by ${Math.round((weatherF - 1) * 100)}%. Allow extra time.`
    : "All routes clear. Fastest route recommended.";

  return {
    ok: true,
    copilot: {
      distanceMeters: Math.round(distMeters),
      baseDurationMin: Math.round(baseDurationMin),
      trafficFactor: traffic,
      weather,
      weatherFactor: weatherF,
      estimatedDurationMin: Math.round(actualDurationMin),
      alternatives,
      advice: copilotAdvice,
      timestamp: nowISO(),
    },
  };
}

/* ── Predictive Delivery Window ── */

export async function predictDeliveryWindow(env, projectId, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const distMeters = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const distKm = distMeters / 1000;

  const stats = await env.DB.prepare(
    `SELECT avg(distance_meters) as avg_dist, count(*) as sample_count
     FROM fleet_trips WHERE fleet_id = ? AND status IN ('completed','active') AND distance_meters > 0`,
  ).bind(projectId).first();
  const sampleCount = Math.max(1, stats?.sample_count || 1);
  const avgDist = stats?.avg_dist || 5000;

  const hour = new Date().getHours();
  const isPeak = hour >= 8 && hour <= 10 || hour >= 17 && hour <= 19;
  const peakFactor = isPeak ? 1.25 : 1;

  const avgSpeedKmph = 25 / peakFactor;
  const baseMin = (distKm / avgSpeedKmph) * 60;
  const varianceMin = 3 + distKm * 0.5 + (isPeak ? 4 : 0);

  const lowMin = Math.max(5, Math.round(baseMin - varianceMin * 0.5));
  const highMin = Math.round(baseMin + varianceMin * 0.5);
  const confidence = Math.round(Math.max(75, Math.min(99, 100 - varianceMin * 1.5)));

  const now = new Date();
  const lowDate = new Date(now.getTime() + lowMin * 60000);
  const highDate = new Date(now.getTime() + highMin * 60000);

  return {
    ok: true,
    window: {
      distanceKm: Math.round(distKm * 10) / 10,
      estimatedMinutes: Math.round(baseMin),
      windowLowMinutes: lowMin,
      windowHighMinutes: highMin,
      windowLow: lowDate.toISOString(),
      windowHigh: highDate.toISOString(),
      confidencePercent: confidence,
      sampleSize: sampleCount,
      factors: { peakHour: isPeak, averageSpeedKmph: Math.round(avgSpeedKmph * 10) / 10 },
    },
  };
}

/* ── Dynamic Pricing ── */

export async function dynamicPricing(env, projectId) {
  const active = await env.DB.prepare(
    `SELECT count(*) as cnt FROM fleet_trips WHERE fleet_id = ? AND status = 'active'`,
  ).bind(projectId).first();
  const available = await env.DB.prepare(
    `SELECT count(*) as cnt FROM fleet_vehicles WHERE fleet_id = ? AND status IN ('online','idle')`,
  ).bind(projectId).first();
  const activeTrips = active?.cnt || 0;
  const availableDrivers = Math.max(1, available?.cnt || 1);
  const demandRatio = activeTrips / availableDrivers;

  let surgeMultiplier = 1;
  let surgeLabel = "Standard";
  if (demandRatio > 2) { surgeMultiplier = 1.5 + (demandRatio - 2) * 0.2; surgeLabel = "Peak"; }
  else if (demandRatio > 1.5) { surgeMultiplier = 1.25; surgeLabel = "High demand"; }
  else if (demandRatio > 1) { surgeMultiplier = 1.1; surgeLabel = "Slight surge"; }

  const basePrice = 5 + Math.floor(Math.random() * 5);
  const surgePrice = Math.round(basePrice * surgeMultiplier * 100) / 100;

  return {
    ok: true,
    pricing: {
      basePrice,
      surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
      surgePrice,
      surgeLabel,
      activeTrips,
      availableDrivers,
      demandRatio: Math.round(demandRatio * 10) / 10,
      currency: "EUR",
    },
  };
}
