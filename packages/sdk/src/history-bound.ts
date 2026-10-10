/** Ably history start/end: ISO string or epoch milliseconds. */
export function historyBoundParam(value?: string | number | null): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const text = String(value).trim();
  return text || null;
}
