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
 * POST /approvals/:id/decision  { decision: "approve" | "reject" }
 */
export async function dispatchHitlApprovalRoutes(request, url, h) {
  const path = url.pathname;

  const isLegacy = path.startsWith("/api/hitl/approvals");
  const decisionMatch = path.match(/^\/approvals\/([^/]+)\/decision$/);
  if (!isLegacy && !decisionMatch) return null;

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
  try {
    const updated =
      action === "approve"
        ? await store.approve(approvalId, auth.userId, note)
        : await store.deny(approvalId, auth.userId, note);
    return json({ approval: updated, ok: true }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "decision_failed";
    const status = message === "not_current_approver" ? 403 : 409;
    return json({ error: message }, { status, headers: corsHeaders });
  }
}
