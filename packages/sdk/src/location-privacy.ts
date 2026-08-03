import type { LocationTelemetry } from "@fluxy-chat/protocol";

export interface LocationPrivacyOptions {
  /** Round coordinates to this grid size in meters (default 50). Set 0 to disable rounding. */
  precisionMeters?: number;
  /** Drop updates when reported accuracy exceeds this (default 500m). */
  maxAccuracyMeters?: number;
}

const DEFAULT_PRECISION_METERS = 50;
const DEFAULT_MAX_ACCURACY_METERS = 500;

/** Meters per degree latitude (approximate). */
const METERS_PER_DEGREE_LAT = 111_320;

function roundToGrid(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Reduce coordinate precision for privacy (grid rounding).
 * At 50m precision, lat/lng are snapped to ~0.00045° cells.
 */
export function roundLocationCoordinates(
  latitude: number,
  longitude: number,
  precisionMeters = DEFAULT_PRECISION_METERS,
): { latitude: number; longitude: number } {
  if (precisionMeters <= 0) {
    return { latitude, longitude };
  }
  const latStep = precisionMeters / METERS_PER_DEGREE_LAT;
  const lngStep =
    precisionMeters / (METERS_PER_DEGREE_LAT * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  return {
    latitude: roundToGrid(latitude, latStep),
    longitude: roundToGrid(longitude, lngStep),
  };
}

/**
 * Apply privacy policy before publishing or displaying location telemetry.
 * Returns `null` when accuracy is too poor to trust.
 */
export function applyLocationPrivacy(
  telemetry: LocationTelemetry,
  options: LocationPrivacyOptions = {},
): LocationTelemetry | null {
  const maxAccuracy = options.maxAccuracyMeters ?? DEFAULT_MAX_ACCURACY_METERS;
  const precision = options.precisionMeters ?? DEFAULT_PRECISION_METERS;

  if (
    typeof telemetry.accuracy === "number" &&
    Number.isFinite(telemetry.accuracy) &&
    telemetry.accuracy > maxAccuracy
  ) {
    return null;
  }

  const rounded = roundLocationCoordinates(
    telemetry.latitude,
    telemetry.longitude,
    precision,
  );

  return {
    ...telemetry,
    latitude: rounded.latitude,
    longitude: rounded.longitude,
    accuracy: typeof telemetry.accuracy === "number"
      ? Math.max(telemetry.accuracy, precision)
      : precision,
  };
}
