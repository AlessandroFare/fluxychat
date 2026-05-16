import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readFluxyMetadata } from "@/lib/clerk-fluxy-metadata";
import { isClerkEnabled } from "@/lib/clerk-config";
import { getHostedWorkerConfig } from "@/lib/hosted-worker";
import { getConsoleApiKey } from "@/lib/fluxy-server";

export async function GET() {
  const { workerUrl, hostedCloud } = getHostedWorkerConfig();
  const bootstrapConfigured = Boolean(getConsoleApiKey());

  if (!isClerkEnabled()) {
    return NextResponse.json({
      clerk: false,
      canAutoConnect: false,
      canProvision: false,
      workerUrl,
      hostedCloud,
    });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({
      clerk: true,
      signedIn: false,
      canAutoConnect: false,
      canProvision: bootstrapConfigured,
      workerUrl,
      hostedCloud,
    });
  }

  const user = await currentUser();
  const meta = readFluxyMetadata(user?.publicMetadata as Record<string, unknown> | undefined);

  return NextResponse.json({
    clerk: true,
    signedIn: true,
    canAutoConnect: bootstrapConfigured,
    canProvision: bootstrapConfigured,
    workerUrl,
    hostedCloud,
    clerkUserId: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    fluxyProjectId: meta.fluxyProjectId ?? null,
    fluxyProjectName: meta.fluxyProjectName ?? null,
    hasProvisionedProject: Boolean(meta.fluxyProjectId),
  });
}
