/** Max UTF-16 code units for a single WS JSON frame (DoS bound). */
export const FLUXY_MAX_WS_FRAME_CHARS = 256_000;

export function isWsFrameWithinSizeLimit(raw: unknown, max = FLUXY_MAX_WS_FRAME_CHARS): boolean {
  if (typeof raw === "string") return raw.length <= max;
  if (typeof raw === "object" && raw !== null) {
    try {
      return JSON.stringify(raw).length <= max;
    } catch {
      return false;
    }
  }
  return false;
}
