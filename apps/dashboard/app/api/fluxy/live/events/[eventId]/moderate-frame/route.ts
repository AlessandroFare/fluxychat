import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

/** POST /api/fluxy/live/events/:eventId/moderate-frame */
export async function POST(request: Request, context: RouteContext) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const { eventId } = await context.params;
  const body = await request.text();
  const workerBase = getWorkerUrl().replace(/\/$/, "");

  try {
    const workerRes = await fetch(
      `${workerBase}/api/live/events/${encodeURIComponent(eventId)}/moderate-frame`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body,
      },
    );
    const json = await workerRes.json().catch(() => ({}));
    return NextResponse.json(json, { status: workerRes.status });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Worker unreachable");
    return NextResponse.json({ error: `Proxy failed: ${message}` }, { status: 502 });
  }
}
