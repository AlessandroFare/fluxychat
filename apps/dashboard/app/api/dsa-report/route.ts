import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/hosted-worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  try {
    const res = await fetch(`${getWorkerUrl()}/public/dsa-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_upstream" }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "worker_unreachable" }, { status: 502 });
  }
}
