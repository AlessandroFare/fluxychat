export interface LocationTelemetry {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationTrack extends LocationTelemetry {
  trackId: string;
  userId: string;
  roomId: string;
  updatedAt: string;
  staleAt: string;
}

export interface LocationUpdateOutbound extends LocationTelemetry {
  type: "location_update";
  trackId: string;
  timestamp?: string;
}

export interface LocationTrackEndedOutbound {
  type: "location_track_ended";
  trackId: string;
}

export interface LocationUpdateInbound extends LocationTrack {
  type: "location_update";
}

export interface LocationSnapshotInbound {
  type: "location_snapshot";
  roomId: string;
  tracks: LocationTrack[];
  generatedAt: string;
}

export interface LocationTrackEndedInbound {
  type: "location_track_ended";
  roomId: string;
  trackId: string;
  userId: string;
  endedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isOptionalFinite(value: unknown, min: number, max: number): boolean {
  return value === undefined || value === null || isFiniteInRange(value, min, max);
}

export function isValidLocationTrackId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value);
}

export function isValidLocationUpdate(value: unknown): value is LocationUpdateOutbound {
  if (!isRecord(value) || value.type !== "location_update") return false;
  if (!isValidLocationTrackId(value.trackId)) return false;
  if (!isFiniteInRange(value.latitude, -90, 90)) return false;
  if (!isFiniteInRange(value.longitude, -180, 180)) return false;
  if (!isOptionalFinite(value.accuracy, 0, 100_000)) return false;
  if (!isOptionalFinite(value.altitude, -20_000, 100_000)) return false;
  if (!isOptionalFinite(value.heading, 0, 360)) return false;
  if (!isOptionalFinite(value.speed, 0, 100_000)) return false;
  return value.timestamp === undefined ||
    (typeof value.timestamp === "string" && Number.isFinite(Date.parse(value.timestamp)));
}

export function isValidLocationTrackEnded(value: unknown): value is LocationTrackEndedOutbound {
  return isRecord(value) && value.type === "location_track_ended" && isValidLocationTrackId(value.trackId);
}
