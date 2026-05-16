import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { resolveProjectApiKeyForClerkUser } from "@/lib/fluxy-provision";
import { getConsoleApiKey, mintWorkerToken } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * POST /api/fluxy/mint-member
 * Mint member JWT server-side — never call Worker /auth/token from the browser with an API key.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    memberUserId?: string;
    ttlSeconds?: number;
    projectApiKey?: string;
  };

  const memberUserId = body.memberUserId?.trim();
  if (!memberUserId) {
    return NextResponse.json({ error: "memberUserId required" }, { status: 400 });
  }

  let clerkUserId: string | null = null;
  if (isClerkEnabled()) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    clerkUserId = userId;
  }

  const apiKey =
    body.projectApiKey?.trim() ||
    (clerkUserId ? await resolveProjectApiKeyForClerkUser(clerkUserId) : null) ||
    getConsoleApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No API key available. Set FLUXY_CONSOLE_API_KEY on the server or create a project first (API key is sent once to this route, not stored).",
      },
      { status: 503 },
    );
  }

  try {
    const minted = await mintWorkerToken(
      {
        userId: memberUserId,
        roles: ["member"],
        ttlSeconds: body.ttlSeconds ?? 3600,
      },
      apiKey,
    );
    return NextResponse.json({
      memberJwt: minted.token,
      expiresIn: minted.expiresIn,
      projectId: minted.claims.tid,
    });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Mint failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
