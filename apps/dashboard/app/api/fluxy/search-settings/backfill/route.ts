import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/** POST /api/fluxy/search-settings/backfill */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const body = await request.text();
  const workerBase = getWorkerUrl().replace(/\/$/, "");
  try {
    const workerRes = await fetch(`${workerBase}/search/messages/backfill`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: body || "{}",
    });
    const json = await workerRes.json().catch(() => ({}));
    return NextResponse.json(json, { status: workerRes.status });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Worker unreachable");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
