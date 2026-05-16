/**
 * Hosted SaaS: platform operator vs tenant boundaries and shared-resource policy.
 */

export function isHostedMultiTenantMode(env) {
  return env.HOSTED_MULTI_TENANT === "true" || env.HOSTED_SAAS === "true";
}

export function getPlatformProjectIdSet(env) {
  const raw =
    env.FLUXY_PLATFORM_PROJECT_ID ||
    env.PLATFORM_PROJECT_ID ||
    env.FLUXY_CONSOLE_PROJECT_ID ||
    "";
  return new Set(
    String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isPlatformOperatorProject(projectId, env) {
  if (!isHostedMultiTenantMode(env)) return true;
  const platformIds = getPlatformProjectIdSet(env);
  if (platformIds.size === 0) return false;
  return platformIds.has(projectId);
}

export function canCreateTenantProjects(adminAuth, env) {
  if (!isHostedMultiTenantMode(env)) return true;
  return isPlatformOperatorProject(adminAuth?.projectId, env);
}

/**
 * Tenants may only access their own project; platform operators are unrestricted.
 * @returns {null | { status: number, error: string, reason: string }}
 */
export function tenantScopeForbidden(adminAuth, targetProjectId, env) {
  if (!isHostedMultiTenantMode(env)) return null;
  if (isPlatformOperatorProject(adminAuth.projectId, env)) return null;
  if (adminAuth.projectId !== targetProjectId) {
    return { status: 403, error: "forbidden", reason: "tenant_scope" };
  }
  return null;
}

/**
 * In hosted mode, only the platform operator project may change plans via the admin API.
 * @returns {null | { status: number, error: string, reason: string }}
 */
export function hostedTenantPlanMutationForbidden(adminAuth, env) {
  if (!isHostedMultiTenantMode(env)) return null;
  if (isPlatformOperatorProject(adminAuth?.projectId, env)) return null;
  return {
    status: 403,
    error: "forbidden",
    reason: "platform_operator_required",
    message: "Plan changes are managed by the platform. Upgrade via Billing when available.",
  };
}

/**
 * Whether Worker-level LLM keys (AI_API_KEY, ANTHROPIC_API_KEY, etc.) may be used for a project.
 * Hosted tenants must bring their own provider keys (project_llm_credentials).
 */
export function workerSharedLlmAllowed(env, projectId) {
  if (!isHostedMultiTenantMode(env)) return true;
  if (env.ALLOW_WORKER_LLM_FALLBACK === "true") return true;
  return isPlatformOperatorProject(projectId, env);
}
