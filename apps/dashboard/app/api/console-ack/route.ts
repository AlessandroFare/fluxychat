import { NextResponse } from "next/server";
import { CONSOLE_ACK_COOKIE, getDashboardAccessMode } from "@/lib/dashboard-access";

const MAX_AGE_SEC = 60 * 60 * 24 * 90;

/**
 * Sets httpOnly cookie after user acknowledges operator-console terms.
 * Optional: set CONSOLE_GATE_SECRET in env — POST JSON { "secret": "..." } must match.
 */
export async function POST(request: Request) {
  if (getDashboardAccessMode() !== "ack") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const gate = process.env.CONSOLE_GATE_SECRET?.trim();
  if (gate) {
    let body: { secret?: string } = {};
    try {
      body = (await request.json()) as { secret?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (body.secret !== gate) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONSOLE_ACK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
