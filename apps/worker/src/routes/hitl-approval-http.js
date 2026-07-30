import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAppKv } from "../lib/app-kv.js";
import { createApprovalStore } from "../lib/hitl-approval.js";

/**
 * HITL tool approval API (Portal A-3).
 * GET  /api/hitl/approvals?roomId=
 * POST /api/hitl/approvals/:id/approve
 * POST /api/hitl/approvals/:id/deny
 */
export async function dispatchHitlApprovalRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/hitl/approvals")) return null;

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

  const kv = resolveAppKv(env);
  if (!kv) {
    return json({ error: "kv_not_configured" }, { status: 503, headers: corsHeaders });
  }

  const store = createApprovalStore(kv);

  if (path === "/api/hitl/approvals" && request.method === "GET") {
    const roomId = url.searchParams.get("roomId");
    if (!roomId) {
      return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const pending = await store.getPendingForRoom(roomId);
    return json({ approvals: pending }, { headers: corsHeaders });
  }

  const approveMatch = path.match(/^\/api\/hitl\/approvals\/([^/]+)\/(approve|deny)$/);
  if (approveMatch && request.method === "POST") {
    const approvalId = decodeURIComponent(approveMatch[1]);
    const action = approveMatch[2];
    const body = await request.json().catch(() => ({}));
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
    const updated =
      action === "approve"
        ? await store.approve(approvalId, auth.userId, note)
        : await store.deny(approvalId, auth.userId, note);
    return json({ approval: updated }, { headers: corsHeaders });
  }

  return null;
}
