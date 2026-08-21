/**
 * Shared stub deps for Worker route auth-matrix tests.
 * Covers ROUTE_DEP_KEY_CATALOG so any dispatch module can be probed.
 */
import { ROUTE_DEP_KEY_CATALOG } from "./route-http-deps.js";

export function createAuthMatrixDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  const stubs = {};
  for (const key of ROUTE_DEP_KEY_CATALOG) {
    stubs[key] = async () => null;
  }

  const base = {
    ...stubs,
    env: { DB: overrides.db ?? null },
    ctx: { waitUntil: () => {} },
    traceId: "t",
    projectId: null,
    corsHeaders,
    requireAdminAuth: true,
    MAX_MESSAGE_LENGTH: 8000,
    maxRoomNameLength: 128,
    json: (data, second = {}, third) => {
      const status =
        typeof second === "number"
          ? second
          : typeof third === "number"
            ? third
            : Number(second?.status || 200);
      const extraHeaders = typeof second === "object" && second ? second.headers || {} : {};
      return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", ...corsHeaders, ...extraHeaders },
      });
    },
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext: overrides.verifyJwt ?? (async () => null),
    verifyJwt: overrides.verifyJwt ?? (async () => null),
    logError: () => {},
    logInfo: () => {},
    hasAnyRole: (roles, needed) => {
      if (typeof overrides.hasAnyRole === "function") return overrides.hasAnyRole(roles, needed);
      const have = new Set((roles || []).map(String));
      return (needed || []).some((r) => have.has(r));
    },
    isValidId: (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s),
    isValidHandle: () => true,
    validateMessageContent: (c) =>
      typeof c === "string" && c.length
        ? { valid: true, content: c }
        : { valid: false, error: "content required" },
    validateRoomName: (name) =>
      typeof name === "string" && name.trim()
        ? { valid: true, name: name.trim() }
        : { valid: false, error: "name required" },
    validateRoles: (roles) => ({ roles: Array.isArray(roles) ? roles : ["member"] }),
    canAccessRoom: async () => true,
    canBypassRoomMembership: () => false,
    canCreateTenantProjects: () => false,
    tenantScopeForbidden: () => null,
    writeAuditEvent: async () => {},
    checkAndConsumeProjectQuota: async () => ({ allowed: true }),
    quotaResetInfo: () => ({}),
    checkAndConsumeRateLimit: async () => ({ allowed: true }),
    incrementOperationalMetric: () => {},
    extractMentions: () => [],
    extractFirstUrl: () => null,
    fetchOgPreview: async () => null,
    sanitizeMessageAttachments: (a) => a || [],
    attachAttachmentsToMessages: async (msgs) => msgs,
    deliverWebhooks: async () => {},
    invokeMentionedAgents: async () => {},
    schedulePostMessageAutomations: () => {},
    safeSchedulePostMessageAutomations: () => {},
    processPendingWebhookDeliveries: async () => {},
    generateRoomSummaryAndAnnounce: async () => {},
    getCachedOrFetch: async (_k, fn) => fn(),
    invalidateCache: () => {},
    escapeLike: (s) => String(s || ""),
    escapeCsvField: (s) => String(s ?? ""),
    sanitizeString: (s) => String(s ?? ""),
    upsertAgentFromBody: async () => ({ id: "bot-1", name: "bot" }),
    mapBotRowToAgent: (r) => r,
    executeAgentRun: async () => ({}),
    createAgentStreamHooks: () => ({}),
    hashWebhookSecret: async (s) => s,
    signWebhookPayload: async () => "sig",
    timingSafeEqual: (a, b) => a === b,
    hashApiKey: async (s) => s,
    getFileExtension: () => "",
    validateFileUpload: () => ({ ok: true }),
    resolveProjectId: () => "proj_1",
    signJwtHs256: async () => "jwt",
    listProjectsForAdmin: async () => [],
    insertNewProject: async () => ({}),
    listLlmProvidersForApi: async () => [],
    getProjectPlan: async () => ({ planName: "free" }),
    getDefaultQuotaLimit: () => 1000,
    monthKeyUtc: () => "2026-08",
    toMinuteBucketIso: () => new Date().toISOString(),
    evaluateOperationalAlerts: async () => {},
    getWebhookEncryptionKey: () => null,
    encryptWebhookSecret: async (s) => s,
    isRoomMember: async () => true,
    customDomain: null,
    ...overrides.extra,
  };

  return base;
}

export function unauthorizedRequest(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(`http://127.0.0.1:8787${path}`, init);
}
