import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * GET /api/fluxy/search-messages?q=...&roomId=...
 * Proxies message search to the Worker (avoids browser CORS to the Worker origin).
 * Pass `Authorization: Bearer <jwt>` from the dashboard session.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const incoming = new URL(request.url);
  const q = incoming.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set("q", q);
  const roomId = incoming.searchParams.get("roomId")?.trim();
  if (roomId) params.set("roomId", roomId);
  const limit = incoming.searchParams.get("limit")?.trim();
  if (limit) params.set("limit", limit);

  const workerBase = getWorkerUrl().replace(/\/$/, "");
  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerBase}/search/messages?${params.toString()}`, {
      headers: { Authorization: auth },
    });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Worker unreachable");
    return NextResponse.json(
      { error: `Search proxy failed: ${message}. Is the Worker running at ${workerBase}?` },
      { status: 502 },
    );
  }

  const contentType = workerRes.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const snippet = (await workerRes.text()).slice(0, 120);
    return NextResponse.json(
      {
        error: `Worker returned non-JSON (${workerRes.status}). Check NEXT_PUBLIC_FLUXYCHAT_WORKER_URL (${workerBase}).`,
        detail: snippet,
      },
      { status: 502 },
    );
  }

  const json = await workerRes.json().catch(() => ({}));
  return NextResponse.json(json, { status: workerRes.status });
}
