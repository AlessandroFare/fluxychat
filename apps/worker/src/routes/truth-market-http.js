import { pickRouteDeps } from "./route-http-deps.js";
import {
  createTruthClaim,
  listTruthClaims,
  getTruthClaim,
  getTruthDisputesForClaim,
  fileTruthDispute,
  resolveTruthDispute,
  getTruthCredits,
  grantTruthCredits,
} from "../lib/truth-market.js";

export async function dispatchTruthMarketRoutes(request, url, h) {
  const path = url.pathname;
  if (
    !path.startsWith("/truth-claims") &&
    !path.startsWith("/admin/truth-market") &&
    !path.includes("/truth-claims")
  ) {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (path === "/admin/truth-market/credits" && request.method === "GET") {
      const userId = url.searchParams.get("userId") || auth.userId;
      if (userId !== auth.userId && !hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const credits = await getTruthCredits(env, { projectId: auth.projectId, userId });
      return json({ ok: true, credits, userId }, { headers: corsHeaders });
    }

    if (path === "/admin/truth-market/credits/grant" && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json().catch(() => null);
      const userId = body?.userId || auth.userId;
      const result = await grantTruthCredits(env, {
        projectId: auth.projectId,
        userId,
        amount: body?.amount,
        reason: body?.reason || "admin_grant",
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    const roomListMatch = path.match(/^\/rooms\/([^/]+)\/truth-claims$/);
    if (roomListMatch && request.method === "GET") {
      const roomId = decodeURIComponent(roomListMatch[1]);
      const claims = await listTruthClaims(env, {
        projectId: auth.projectId,
        roomId,
        state: url.searchParams.get("state") || undefined,
        limit: Number(url.searchParams.get("limit") || 50),
      });
      return json({ ok: true, claims }, { headers: corsHeaders });
    }

    if (roomListMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await createTruthClaim(env, auth, {
        roomId: decodeURIComponent(roomListMatch[1]),
        content: body.content,
        stakeAmount: body.stakeAmount ?? body.stake,
        ttlSeconds: body.ttlSeconds,
        messageId: body.messageId,
        agentId: body.agentId,
      });
      if (!result.ok) {
        const status =
          result.error === "forbidden" ? 403 :
          result.error === "insufficient_credits" ? 402 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    const claimMatch = path.match(/^\/truth-claims\/([^/]+)$/);
    if (claimMatch && request.method === "GET") {
      const claimId = decodeURIComponent(claimMatch[1]);
      const claim = await getTruthClaim(env, auth.projectId, claimId);
      if (!claim) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      const disputes = await getTruthDisputesForClaim(env, auth.projectId, claimId);
      return json({ ok: true, claim, disputes }, { headers: corsHeaders });
    }

    const disputeMatch = path.match(/^\/truth-claims\/([^/]+)\/disputes$/);
    if (disputeMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await fileTruthDispute(env, auth, {
        claimId: decodeURIComponent(disputeMatch[1]),
        evidence: body?.evidence,
      });
      if (!result.ok) {
        const status =
          result.error === "forbidden" ? 403 :
          result.error === "dispute_rate_limit_exceeded" ? 429 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    const resolveMatch = path.match(/^\/admin\/truth-claims\/([^/]+)\/disputes\/([^/]+)\/resolve$/);
    if (resolveMatch && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json().catch(() => null);
      const result = await resolveTruthDispute(env, auth, {
        claimId: decodeURIComponent(resolveMatch[1]),
        disputeId: decodeURIComponent(resolveMatch[2]),
        outcome: body?.outcome,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (path === "/truth-claims" && request.method === "GET") {
      const claims = await listTruthClaims(env, {
        projectId: auth.projectId,
        roomId: url.searchParams.get("roomId") || undefined,
        state: url.searchParams.get("state") || undefined,
        limit: Number(url.searchParams.get("limit") || 50),
      });
      return json({ ok: true, claims }, { headers: corsHeaders });
    }

    return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  } catch (err) {
    logError("truth_market.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
