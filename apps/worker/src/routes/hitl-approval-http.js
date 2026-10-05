import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAppKv } from "../lib/app-kv.js";
import { createApprovalStore } from "../lib/hitl-approval.js";
import { createD1ApprovalStore } from "../lib/hitl-approval-d1.js";

function approvalStoreForEnv(env) {
  try {
    return createD1ApprovalStore(env);
  } catch {
    return null;
  }
}

function kvStoreForEnv(env) {
  const kv = resolveAppKv(env);
  return kv ? createApprovalStore(kv) : null;
}

/**
 * HITL tool approval API.
 * GET  /api/hitl/approvals?roomId= | ?approverId=me
 * POST /api/hitl/approvals/:id/approve | /deny
 * GET/PUT/DELETE /api/hitl/slack-user-map
 * POST /approvals/require  { toolName, toolInput?, approverIds? }
 * GET  /api/hitl/metrics
 * POST /approvals/:id/decision  { decision: "approve" | "reject" }
 */
export async function dispatchHitlApprovalRoutes(request, url, h) {
  const path = url.pathname;

  const isSlackMap = path === "/api/hitl/slack-user-map";
  const isLegacy = path.startsWith("/api/hitl/approvals");
  const isRequire = path === "/approvals/require";
  const isMetrics = path === "/api/hitl/metrics";
  const decisionMatch = path.match(/^\/approvals\/([^/]+)\/decision$/);
  if (!isSlackMap && !isLegacy && !isRequire && !isMetrics && !decisionMatch) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    canAccessRoom,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "verifyJwtAndGetContext", "canAccessRoom"]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    return null;
  });
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isSlackMap) {
    const {
      listHitlSlackUserMap,
      upsertHitlSlackUserMap,
      deleteHitlSlackUserMap,
      isValidSlackUserId,
    } = await import("../lib/hitl-slack-user-map.js");
    const roles = auth.roles ?? [];
    const isAdmin = roles.includes("admin") || roles.includes("owner");

    if (request.method === "GET") {
      const rows = await listHitlSlackUserMap(env, auth.projectId, {
        onlyUserId: isAdmin ? undefined : auth.userId,
      });
      return json({ ok: true, mappings: rows }, { headers: corsHeaders });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const slackUserId = String(body.slackUserId || "").trim();
      const fluxyUserId = String(body.fluxyUserId || auth.userId || "").trim();
      if (!isValidSlackUserId(slackUserId)) {
        return json({ error: "invalid_slack_user_id" }, { status: 400, headers: corsHeaders });
      }
      if (!isAdmin && fluxyUserId !== auth.userId) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const saved = await upsertHitlSlackUserMap(env, auth.projectId, slackUserId, fluxyUserId);
      if (!saved) {
        return json({ error: "invalid_ids" }, { status: 400, headers: corsHeaders });
      }
      return json({ ok: true, mapping: saved }, { headers: corsHeaders });
    }

    if (request.method === "DELETE") {
      const slackUserId = String(url.searchParams.get("slackUserId") || "").trim();
      if (!isValidSlackUserId(slackUserId)) {
        return json({ error: "invalid_slack_user_id" }, { status: 400, headers: corsHeaders });
      }
      const rows = await listHitlSlackUserMap(env, auth.projectId, {
        onlyUserId: isAdmin ? undefined : auth.userId,
      });
      const owned = rows.some((row) => row.slackUserId === slackUserId);
      if (!owned) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      await deleteHitlSlackUserMap(env, auth.projectId, slackUserId);
      return json({ ok: true }, { headers: corsHeaders });
    }

    return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
  }

  if (isRequire) {
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const { requireApprovalRoom } = await import("../lib/require-approval-room.js");
    const result = await requireApprovalRoom(env, {
      projectId: auth.projectId,
      requesterUserId: auth.userId,
      toolName: body.toolName,
      toolInput: body.toolInput,
      reason: body.reason,
      approverIds: Array.isArray(body.approverIds) ? body.approverIds : [],
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (isMetrics) {
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
    }
    const { loadHitlFatigueMetrics } = await import("../lib/hitl-fatigue-metrics.js");
    const metrics = await loadHitlFatigueMetrics(env, auth.projectId);
    return json({ ok: true, metrics }, { headers: corsHeaders });
  }

  const d1Store = approvalStoreForEnv(env);
  const kvStore = kvStoreForEnv(env);

  if (path === "/api/hitl/approvals" && request.method === "GET") {
    const roomId = url.searchParams.get("roomId");
    const approverParam = url.searchParams.get("approverId");

    if (approverParam === "me" || approverParam === auth.userId) {
      if (!d1Store) {
        return json({ approvals: [], pendingCount: 0 }, { headers: corsHeaders });
      }
      const pending = await d1Store.getPendingForApprover(auth.projectId, auth.userId);
      return json({ approvals: pending, pendingCount: pending.length }, { headers: corsHeaders });
    }

    if (!roomId) {
      return json({ error: "roomId_or_approverId_required" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (d1Store) {
      const pending = await d1Store.getPendingForRoom(auth.projectId, roomId);
      return json({ approvals: pending }, { headers: corsHeaders });
    }
    if (!kvStore) {
      return json({ error: "kv_not_configured" }, { status: 503, headers: corsHeaders });
    }
    const pending = await kvStore.getPendingForRoom(roomId);
    return json({ approvals: pending }, { headers: corsHeaders });
  }

  const evidenceMatch = path.match(/^\/api\/hitl\/approvals\/([^/]+)\/evidence$/);
  if (evidenceMatch && request.method === "GET") {
    const store = d1Store ?? kvStore;
    if (!store) {
      return json({ error: "approval_store_unavailable" }, { status: 503, headers: corsHeaders });
    }
    const approvalId = decodeURIComponent(evidenceMatch[1]);
    const entry = await store.get(approvalId);
    if (!entry) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }
    if (entry.roomId) {
      const allowed = await canAccessRoom(env, auth, entry.roomId);
      if (!allowed) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
    }
    const { sealHitlEvidencePack } = await import("../lib/hitl-evidence-pack.js");
    return json({ ok: true, evidence: await sealHitlEvidencePack(entry) }, { headers: corsHeaders });
  }

  const legacyMatch = path.match(/^\/api\/hitl\/approvals\/([^/]+)\/(approve|deny)$/);
  const idFromPath = legacyMatch?.[1] ?? decisionMatch?.[1];
  const isDecisionRoute = Boolean(decisionMatch && request.method === "POST");
  const isLegacyAction = Boolean(legacyMatch && request.method === "POST");

  if (!isDecisionRoute && !isLegacyAction) return null;

  const approvalId = decodeURIComponent(idFromPath);
  const body = await request.json().catch(() => ({}));

  let action = legacyMatch?.[2];
  if (isDecisionRoute) {
    const decision = String(body.decision ?? "").toLowerCase();
    if (decision === "approve" || decision === "approved") action = "approve";
    else if (decision === "reject" || decision === "denied" || decision === "deny") action = "deny";
    else return json({ error: "invalid_decision" }, { status: 400, headers: corsHeaders });
  }

  const store = d1Store ?? kvStore;
  if (!store) {
    return json({ error: "approval_store_unavailable" }, { status: 503, headers: corsHeaders });
  }

  const entry = await store.get(approvalId);
  if (!entry) {
    return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  }
  if (entry.roomId) {
    const allowed = await canAccessRoom(env, auth, entry.roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
  }

  const note = body.note ? String(body.note) : undefined;
  const vercelSig = String(body.vercelSignature || body.signature || "").trim();
  if (vercelSig) {
    const { toolApprovalSecret, verifyVercelToolApproval } = await import(
      "../lib/vercel-tool-approval-hmac.js"
    );
    const secret = toolApprovalSecret(env);
    const ok = await verifyVercelToolApproval(secret, {
      signature: vercelSig,
      approvalId,
      toolCallId: entry.toolCallId,
      toolName: entry.toolName,
      input: entry.toolInput,
    });
    if (!ok) {
      return json({ error: "signature_mismatch" }, { status: 403, headers: corsHeaders });
    }
  }
  try {
    const updated =
      action === "approve"
        ? await store.approve(approvalId, auth.userId, note)
        : await store.deny(approvalId, auth.userId, note);
    return json({ approval: updated, ok: true }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "decision_failed";
    const status =
      message === "not_current_approver" ||
      message === "requester_cannot_approve" ||
      message === "agent_cannot_approve" ||
      message === "maker_checker_requires_human"
        ? 403
        : 409;
    return json({ error: message }, { status, headers: corsHeaders });
  }
}
