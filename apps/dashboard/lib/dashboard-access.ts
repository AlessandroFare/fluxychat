/** HttpOnly cookie set after /enter acknowledgment (or optional shared secret). */
export const CONSOLE_ACK_COOKIE = "fc_console_ack";

/**
 * Console access policy (dashboard `middleware.ts` + `POST /api/console-ack`).
 *
 * - `DASHBOARD_ACCESS_MODE=open` (default): no cookie; all routes reachable (typical local dev).
 * - `DASHBOARD_ACCESS_MODE=ack`: browser must complete `/enter` once so `POST /api/console-ack` sets
 *   {@link CONSOLE_ACK_COOKIE}. This is **not** end-user auth — it stops drive-by UI traffic and sets
 *   expectations. Real spend is still bounded by your Worker (JWT verification, API keys, quotas).
 *
 * Optional: `CONSOLE_GATE_SECRET` — when set, the POST body must include `{ "secret": "<value>" }`.
 */
export function getDashboardAccessMode(): "open" | "ack" {
  const v = process.env.DASHBOARD_ACCESS_MODE?.trim().toLowerCase();
  return v === "ack" ? "ack" : "open";
}
