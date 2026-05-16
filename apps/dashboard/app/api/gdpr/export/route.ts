import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * GET /api/gdpr/export — proxy GDPR JSON download (avoids browser CORS to Worker).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const workerBase = getWorkerUrl().replace(/\/$/, "");
  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerBase}/gdpr/export`, {
      headers: { Authorization: auth },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: `GDPR export proxy failed: ${messageFromUnknown(err, "Worker unreachable")}. Check Worker URL (${workerBase}).`,
      },
      { status: 502 },
    );
  }

  if (!workerRes.ok) {
    const contentType = workerRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await workerRes.json().catch(() => ({}));
      return NextResponse.json(json, { status: workerRes.status });
    }
    const text = await workerRes.text();
    return NextResponse.json(
      { error: text || `Worker returned ${workerRes.status}` },
      { status: workerRes.status },
    );
  }

  const body = await workerRes.arrayBuffer();
  const cd = workerRes.headers.get("Content-Disposition");
  const headers = new Headers();
  headers.set("Content-Type", workerRes.headers.get("Content-Type") || "application/json");
  if (cd) headers.set("Content-Disposition", cd);

  return new NextResponse(body, { status: 200, headers });
}
