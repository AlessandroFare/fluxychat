import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { provisionFluxyForClerkUser } from "@/lib/fluxy-provision";
import { getConsoleApiKey } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * Clerk webhook: provision Fluxychat tenant on user.created (hosted cloud).
 * Configure in Clerk Dashboard → Webhooks → user.created → this URL.
 */
export async function POST(request: NextRequest) {
  if (!isClerkEnabled()) {
    return NextResponse.json({ error: "Clerk not configured" }, { status: 503 });
  }

  if (!getConsoleApiKey()) {
    return NextResponse.json({ error: "FLUXY_CONSOLE_API_KEY not configured" }, { status: 503 });
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const clerkUserId = event.data.id;
  if (!clerkUserId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const result = await provisionFluxyForClerkUser(clerkUserId, user, { createProject: true });

    return NextResponse.json({
      ok: true,
      provisioned: true,
      projectId: result.activeProject?.id ?? null,
      createdNewProject: result.createdNewProject,
    });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Provision failed");
    console.error("[clerk webhook] provision failed", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
