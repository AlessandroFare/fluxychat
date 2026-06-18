import { auth } from "@clerk/nextjs/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { resolveTenantProjectApiKeyForClerkUser } from "@/lib/fluxy-provision";
import { mintMemberTokenWithAdminJwt, mintWorkerToken } from "@/lib/fluxy-server";
import { apiError, apiErrorFromUnknown, apiOk } from "@/lib/api-response";

/**
 * POST /api/fluxy/mint-member
 * Mint member JWT server-side — never accept project API keys from the browser (audit S-1).
 * Returns the shared `{ ok, data | error }` envelope (audit P2).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    memberUserId?: string;
    ttlSeconds?: number;
    // Defensive: ignore legacy/hostile `projectApiKey` / `apiKey` fields in body
    // (audit S-1). Resolution is server-side from Clerk metadata or admin JWT only.
    projectApiKey?: unknown;
    apiKey?: unknown;
  };
  // Explicitly drop any credential-like field; we do not need to do anything
  // with it, but documenting the rejection helps reviewers understand intent.
  void body.projectApiKey;
  void body.apiKey;

  const memberUserId = body.memberUserId?.trim();
  if (!memberUserId) {
    return apiError("memberUserId required", 400);
  }

  // Cap ttl to [60s, 24h] so a hostile caller can't request a near-permanent token.
  const ttlSeconds = Math.min(Math.max(Number(body.ttlSeconds) || 3600, 60), 86400);

  if (isClerkEnabled()) {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return apiError("Sign in required", 401);
    }

    const apiKey = await resolveTenantProjectApiKeyForClerkUser(clerkUserId);
    if (!apiKey) {
      return apiError(
        "No tenant project yet. Complete hosted provisioning (/api/fluxy/connect) before minting member JWTs.",
        403,
      );
    }

    try {
      const minted = await mintWorkerToken(
        { userId: memberUserId, roles: ["member"], ttlSeconds },
        apiKey,
      );
      return apiOk({
        memberJwt: minted.token,
        expiresIn: minted.expiresIn,
        projectId: minted.claims.tid,
      });
    } catch (err: unknown) {
      return apiErrorFromUnknown(err, "Mint failed");
    }
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return apiError(
      "Authorization: Bearer <adminJwt> required when Clerk is disabled",
      401,
    );
  }
  const adminJwt = authHeader.slice("Bearer ".length).trim();
  if (adminJwt.length < 12) {
    return apiError("Invalid admin JWT", 401);
  }

  try {
    const minted = await mintMemberTokenWithAdminJwt(adminJwt, {
      userId: memberUserId,
      roles: ["member"],
      ttlSeconds,
    });
    return apiOk({
      memberJwt: minted.token,
      expiresIn: minted.expiresIn,
      projectId: minted.claims.tid,
    });
  } catch (err: unknown) {
    return apiErrorFromUnknown(err, "Mint failed");
  }
}
