import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { getHostedWorkerConfig } from "@/lib/hosted-worker";
import { getConsoleApiKey } from "@/lib/fluxy-server";

/** Public runtime config for quickstart snippets (no secrets). */
export async function GET() {
  const { workerUrl, hostedCloud, cloudUrl } = getHostedWorkerConfig();

  return NextResponse.json({
    workerUrl,
    hostedCloud,
    cloudUrl,
    clerk: isClerkEnabled(),
    canProvision: Boolean(getConsoleApiKey()),
  });
}
