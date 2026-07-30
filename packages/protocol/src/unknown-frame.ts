/**
 * Forward-compatible wire frame (Portal §6 style).
 * Unknown `type` values are preserved intact for logging, forwarding, or future handlers.
 */
export interface UnknownWsFrame {
  type: string;
  [field: string]: unknown;
}

export function isUnknownWsFrame(value: unknown): value is UnknownWsFrame {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).type === "string"
  );
}
