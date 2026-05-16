/**
 * Pick only the handlers/constants a route module needs from the worker routeDeps bag.
 */
export function pickRouteDeps(h, keys) {
  const out = {};
  for (const key of keys) {
    if (!(key in h)) {
      throw new Error(`routeDeps missing key: ${key}`);
    }
    out[key] = h[key];
  }
  return out;
}

/** All keys that may appear on routeDeps (for dependency analysis scripts). */
export const ROUTE_DEP_KEY_CATALOG = [
  "env",
  "ctx",
  "traceId",
  "corsHeaders",
  "json",
  "requestLogCtx",
  "verifyJwtAndGetContext",
  "hasAnyRole",
  "logError",
  "logInfo",
  "requireAdminAuth",
  "projectId",
  "MAX_MESSAGE_LENGTH",
  "checkAndConsumeProjectQuota",
  "quotaResetInfo",
  "checkAndConsumeRateLimit",
  "incrementOperationalMetric",
  "validateMessageContent",
  "isValidId",
  "isValidHandle",
  "validateRoles",
  "validateRoomName",
  "extractMentions",
  "extractFirstUrl",
  "fetchOgPreview",
  "sanitizeMessageAttachments",
  "deliverWebhooks",
  "invokeMentionedAgents",
  "schedulePostMessageAutomations",
  "upsertAgentFromBody",
  "mapBotRowToAgent",
  "listLlmProvidersForApi",
  "executeAgentRun",
  "createAgentStreamHooks",
  "isRoomMember",
  "canAccessRoom",
  "attachAttachmentsToMessages",
  "getProjectPlan",
  "getDefaultQuotaLimit",
  "monthKeyUtc",
  "toMinuteBucketIso",
  "evaluateOperationalAlerts",
  "hashWebhookSecret",
  "getWebhookEncryptionKey",
  "encryptWebhookSecret",
  "signWebhookPayload",
  "timingSafeEqual",
  "processPendingWebhookDeliveries",
  "escapeLike",
  "canBypassRoomMembership",
  "generateRoomSummaryAndAnnounce",
  "getCachedOrFetch",
  "invalidateCache",
  "escapeCsvField",
  "listProjectsForAdmin",
  "insertNewProject",
  "canCreateTenantProjects",
  "tenantScopeForbidden",
  "writeAuditEvent",
  "hashApiKey",
  "verifyJwt",
  "sanitizeString",
  "validateFileUpload",
  "getFileExtension",
  "resolveProjectId",
  "signJwtHs256",
  "maxRoomNameLength",
];
