import { NextResponse } from "next/server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * Shared API response envelope for dashboard Route Handlers.
 *
 * Every dashboard API route returns a consistent shape so the client can use
 * one parsing path:
 *   - success: { ok: true, data: T }
 *   - failure: { ok: false, error: string }
 *
 * All responses set `Cache-Control: no-store` because most of these routes
 * mint/proxy credentials or per-user data — caching would leak tokens or
 * cross-user state through intermediary caches. (Audit P2 fix.)
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Build a success response: `{ ok: true, data }`. */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: NO_STORE });
}

/**
 * Build a success response for a void/no-content operation: `{ ok: true }`.
 * Used by routes that only signal completion (e.g. console-ack).
 */
export function apiOkVoid(extra?: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...(extra ?? {}) }, { status, headers: NO_STORE });
}

/** Build a failure response: `{ ok: false, error }`. */
export function apiError(error: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

/**
 * Build a failure response from an unknown caught value, extracting a human
 * message via the shared `messageFromUnknown` helper so every route reports
 * errors consistently.
 */
export function apiErrorFromUnknown(err: unknown, fallback: string, status = 502): NextResponse {
  return apiError(messageFromUnknown(err, fallback), status);
}
