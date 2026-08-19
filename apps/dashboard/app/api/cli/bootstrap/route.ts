import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { buildCliBootstrapForClerkUser } from "@/lib/cli-bootstrap";
import { getConsoleApiKey } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * POST /api/cli/bootstrap
 * After Clerk sign-in from create-fluxy-chat: provision project, assistant room, JWT.
 */
export async function POST() {
  if (!isClerkEnabled()) {
    return NextResponse.json({ error: "Clerk is not configured." }, { status: 503 });
  }
  if (!getConsoleApiKey()) {
    return NextResponse.json(
      { error: "Server missing FLUXY_CONSOLE_API_KEY." },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const user = await currentUser();
    const payload = await buildCliBootstrapForClerkUser(userId, user);
    return NextResponse.json(payload);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: messageFromUnknown(err, "CLI bootstrap failed") },
      { status: 502 },
    );
  }
}
