import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

async function proxyWorker(request: Request, path: string, init?: RequestInit) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const workerBase = getWorkerUrl().replace(/\/$/, "");
  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerBase}${path}`, {
      ...init,
      headers: {
        Authorization: auth,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Worker unreachable");
    return NextResponse.json({ error: `Proxy failed: ${message}` }, { status: 502 });
  }

  const json = await workerRes.json().catch(() => ({}));
  return NextResponse.json(json, { status: workerRes.status });
}

/** GET /api/fluxy/search-settings */
export async function GET(request: Request) {
  return proxyWorker(request, "/search/settings");
}

/** PATCH /api/fluxy/search-settings */
export async function PATCH(request: Request) {
  const body = await request.text();
  return proxyWorker(request, "/admin/search/settings", { method: "PATCH", body });
}
