import { pickRouteDeps } from "./route-http-deps.js";
import {
  appendRoomAuditChainEvent,
  exportRoomAuditChain,
  verifyRoomAuditChain,
} from "../lib/audit-chain.js";

export async function dispatchAuditChainRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/audit-chain")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
    "writeAuditEvent",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && path === "/admin/audit-chain/verify") {
      const limit = Number(url.searchParams.get("limit") || 5000);
      const result = await verifyRoomAuditChain(env, { projectId: auth.projectId, limit });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/audit-chain/export") {
      const limit = Number(url.searchParams.get("limit") || 500);
      const result = await exportRoomAuditChain(env, { projectId: auth.projectId, limit });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/audit-chain/append") {
      const body = await request.json().catch(() => ({}));
      const result = await appendRoomAuditChainEvent(env, {
        projectId: auth.projectId,
        event: {
          type: body.type || "manual",
          action: body.action || "audit_chain.append",
          actorUserId: auth.userId,
          metadata: body.metadata ?? {},
        },
      });
      await writeAuditEvent(env, {
        projectId: auth.projectId,
        actorUserId: auth.userId,
        actorRoles: auth.roles,
        action: "audit_chain.append",
        targetType: "audit_chain",
        targetId: result.eventHash,
      }).catch(() => {});
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/audit-chain/export-r2") {
      const body = await request.json().catch(() => ({}));
      const { exportAuditChainToR2 } = await import("../lib/audit-chain.js");
      const result = await exportAuditChainToR2(env, {
        projectId: auth.projectId,
        limit: body.limit,
      });
      if (!result.ok) {
        return json(result, { status: result.error === "r2_not_configured" ? 503 : 400, headers: corsHeaders });
      }
      await writeAuditEvent(env, {
        projectId: auth.projectId,
        actorUserId: auth.userId,
        actorRoles: auth.roles,
        action: "audit_chain.export_r2",
        targetType: "audit_chain",
        targetId: result.key,
        metadata: { entryCount: result.entryCount, valid: result.valid },
      }).catch(() => {});
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("audit_chain.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
