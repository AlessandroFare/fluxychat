/**
 * Split from worker fetch handler (original lines 3629-3738).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { hostedTenantPlanMutationForbidden } from "../lib/hosted-saas-policy.js";
import { normalizePlanName, planLimitsForTier } from "../lib/plan-tier-limits.js";

export async function dispatchAdminProjectsRoutes(request, url, h) {
  const {
    env,
    ctx,
    traceId,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requireAdminAuth,
    projectId,
    getProjectPlan,
    getDefaultQuotaLimit,
    listProjectsForAdmin,
    insertNewProject,
    canCreateTenantProjects,
    tenantScopeForbidden,
    writeAuditEvent,
    hashApiKey,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "traceId",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requireAdminAuth",
    "projectId",
    "getProjectPlan",
    "getDefaultQuotaLimit",
    "listProjectsForAdmin",
    "insertNewProject",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
    "hashApiKey",
  ]);


  if (url.pathname === "/admin/projects" && request.method === "GET") {
    let adminAuth = null;
    if (requireAdminAuth) {
      adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
    }
    const rows = await listProjectsForAdmin(env, adminAuth);
    const projects = await Promise.all(
      rows.map(async (project) => ({
        ...project,
        plan: await getProjectPlan(env, project.id),
      })),
    );
    return json({ projects });
  }

  if (url.pathname === "/admin/projects" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      if (!canCreateTenantProjects(adminAuth, env)) {
        return json(
          {
            error: "forbidden",
            reason: "tenant_cannot_create_projects",
            message: "Use the hosted console to provision your tenant.",
          },
          { status: 403 },
        );
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.name) {
        return json({ error: "name required" }, { status: 400 });
      }
      const project = await insertNewProject(env, ctx, body.name, {
        audit: { adminAuth, traceId },
        requestLogCtx,
      });
      return json({ project });
    }
  }

  if (
    url.pathname.startsWith("/admin/projects/") &&
    url.pathname.endsWith("/plan") &&
    request.method === "POST"
  ) {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        logError("auth.jwt_verify_failed", err, requestLogCtx);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const planDeny = hostedTenantPlanMutationForbidden(adminAuth, env);
      if (planDeny) {
        return json(
          {
            error: planDeny.error,
            reason: planDeny.reason,
            message: planDeny.message,
          },
          { status: planDeny.status },
        );
      }
      const targetProjectId = url.pathname.split("/")[3];
      const scopeErr = tenantScopeForbidden(adminAuth, targetProjectId, env);
      if (scopeErr) return scopeErr;
      const body = await request.json().catch(() => null);
      if (!targetProjectId || !body?.planName) {
        return json({ error: "project id and planName required" }, { status: 400 });
      }
      const planName = normalizePlanName(body.planName);
      const limits = planLimitsForTier(env, planName);
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO project_plans (project_id, plan_name, billing_status, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly, pricing_version, manually_overridden, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM project_plans WHERE project_id = ?), ?))"
      )
        .bind(
          targetProjectId,
          planName,
          body.billingStatus || "manual",
          limits.messageLimitMonthly,
          limits.agentInvokeLimitMonthly,
          limits.webhookDeliveryLimitMonthly,
          body.pricingVersion || env.DEFAULT_PRICING_VERSION || "v1",
          0,
          now,
          targetProjectId,
          now
        )
        .run();
      const plan = await getProjectPlan(env, targetProjectId);
      return json({ plan });
    }
  }

  if (
    url.pathname.startsWith("/admin/projects/") &&
    url.pathname.endsWith("/keys/rotate") &&
    request.method === "POST"
  ) {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }

      const parts = url.pathname.split("/");
      const targetProjectId = parts[3];
      if (!targetProjectId) {
        return json({ error: "project id required" }, { status: 400 });
      }
      const scopeErr = tenantScopeForbidden(adminAuth, targetProjectId, env);
      if (scopeErr) return scopeErr;

      const project = await env.DB.prepare(
        "SELECT id FROM projects WHERE id = ? LIMIT 1"
      )
        .bind(targetProjectId)
        .first();
      if (!project) {
        return json({ error: "project not found" }, { status: 404 });
      }

      const now = new Date().toISOString();
      const apiKey = `fc_${crypto.randomUUID().replace(/-/g, "")}`;
      const keyPrefix = apiKey.slice(0, 8);
      const keyHash = await hashApiKey(apiKey);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE api_keys SET revoked_at = ? WHERE project_id = ? AND revoked_at IS NULL"
        ).bind(now, targetProjectId),
        env.DB.prepare(
          "INSERT INTO api_keys (id, project_id, secret, key_prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(apiKey, targetProjectId, "", keyPrefix, keyHash, now),
      ]);

      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.api_key.rotate",
          targetType: "project",
          targetId: targetProjectId,
          traceId,
          metadata: { keyPrefix },
        }).catch(() => {})
      );

      return json({
        key: {
          projectId: targetProjectId,
          apiKey,
          keyPrefix,
          rotatedAt: now,
        },
      });
    }
  }

  return null;
}
