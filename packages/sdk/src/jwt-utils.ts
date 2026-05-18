export interface DecodedFluxyJwt {
  exp?: number;
  sub?: string;
  tid?: string;
}

/** Decode payload from a JWT (no signature verification). */
export function decodeFluxyJwtPayload(token: string): DecodedFluxyJwt {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as DecodedFluxyJwt;
  } catch {
    return {};
  }
}

export function jwtRefreshDelayMs(expSeconds: number, bufferMs = 5 * 60 * 1000): number {
  return Math.max(expSeconds * 1000 - Date.now() - bufferMs, 0);
}
