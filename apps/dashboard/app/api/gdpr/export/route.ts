import { NextResponse } from "next/server";
import { getWorkerUrl } from "@/lib/fluxy-server";
import { apiError, apiErrorFromUnknown } from "@/lib/api-response";

/**
 * GET /api/gdpr/export — proxy GDPR JSON download (avoids browser CORS to Worker).
 *
 * Success path streams the Worker's raw body (it may be a file download with a
 * Content-Disposition header, so it cannot use the JSON envelope). Error paths
 * use the shared envelope. The Worker URL is never leaked in error bodies
 * (audit P2). All responses set `Cache-Control: no-store`.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return apiError("Authorization header required", 401);
  }

  const workerBase = getWorkerUrl().replace(/\/$/, "");
  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerBase}/gdpr/export`, {
      headers: { Authorization: auth },
    });
  } catch (err: unknown) {
    return apiErrorFromUnknown(err, "GDPR export proxy failed: Worker unreachable");
  }

  if (!workerRes.ok) {
    const contentType = workerRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = (await workerRes.json().catch(() => ({}))) as { error?: string; message?: string };
      const detail = json.error || json.message || `Worker returned ${workerRes.status}`;
      const hint =
        workerRes.status === 404
          ? " Endpoint not found on the Worker. Redeploy the Worker (includes GET /gdpr/export) and confirm FLUXYCHAT_WORKER_URL / NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL on Vercel."
          : "";
      return apiError(`${detail}.${hint}`, workerRes.status);
    }
    const text = await workerRes.text();
    return apiError(text || `Worker returned ${workerRes.status}`, workerRes.status);
  }

  const body = await workerRes.arrayBuffer();
  const cd = workerRes.headers.get("Content-Disposition");
  const headers = new Headers();
  headers.set("Content-Type", workerRes.headers.get("Content-Type") || "application/json");
  if (cd) headers.set("Content-Disposition", cd);
  headers.set("Cache-Control", "no-store");

  return new NextResponse(body, { status: 200, headers });
}
