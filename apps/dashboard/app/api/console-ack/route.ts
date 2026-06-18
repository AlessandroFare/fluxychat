import { NextResponse } from "next/server";
import { CONSOLE_ACK_COOKIE, getDashboardAccessMode } from "@/lib/dashboard-access";
import { apiError, apiOkVoid } from "@/lib/api-response";

const MAX_AGE_SEC = 60 * 60 * 24 * 90;
const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Sets httpOnly cookie after user acknowledges operator-console terms.
 *
 * Audit S-7: when DASHBOARD_ACCESS_MODE=ack, a CONSOLE_GATE_SECRET MUST be
 * configured. Without it, anyone could POST and obtain the cookie.
 * Returns the shared `{ ok, ... }` envelope (audit P2).
 */
export async function POST(request: Request) {
  if (getDashboardAccessMode() !== "ack") {
    return apiOkVoid({ skipped: true });
  }

  const gate = process.env.CONSOLE_GATE_SECRET?.trim();
  if (!gate) {
    // Refuse to mint the gate cookie without a secret in ack mode.
    return apiError(
      "CONSOLE_GATE_SECRET must be configured when DASHBOARD_ACCESS_MODE=ack",
      503,
    );
  }

  let body: { secret?: string } = {};
  try {
    body = (await request.json()) as { secret?: string };
  } catch {
    return apiError("Invalid JSON", 400);
  }
  if (typeof body.secret !== "string" || body.secret.length === 0) {
    return apiError("Access code required", 400);
  }
  // Use a constant-time compare to avoid a timing side-channel on the gate
  // secret. (Audit P2 hardening.)
  const secretBytes = new TextEncoder().encode(body.secret);
  const gateBytes = new TextEncoder().encode(gate);
  if (secretBytes.length !== gateBytes.length || !timingEqual(secretBytes, gateBytes)) {
    return apiError("Invalid access code", 401);
  }

  // Success path must attach a cookie, so build the response directly while
  // still honoring the shared envelope + no-store header.
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(CONSOLE_ACK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** Constant-time byte comparison for Uint8Array of equal length. */
function timingEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
