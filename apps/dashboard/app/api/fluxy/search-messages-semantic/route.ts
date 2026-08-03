import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * POST /api/fluxy/search-messages-semantic
 * Proxies hybrid/semantic search to the Worker (avoids browser CORS).
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const workerBase = getWorkerUrl().replace(/\/$/, "");
  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerBase}/search/messages/semantic`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
