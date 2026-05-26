// fluxychat Cloudflare Worker
// - WebSocket endpoint for rooms using Durable Objects
// - D1 for message persistence
// Domain libs: ./lib/*; HTTP: ./routes/*-http.js (incl. billing-stripe-http.js → lib/stripe-billing.js).

import { timingSafeEqual } from "./lib/crypto-timing.js";
import {
  monthKeyUtc,
  getDefaultQuotaLimit,
  getProjectPlan,
  checkAndConsumeProjectQuota,
} from "./lib/project-plan-quota.js";
import { planLimitsForTier } from "./lib/plan-tier-limits.js";
import {
  isHostedMultiTenantMode,
  isPlatformOperatorProject,
  canCreateTenantProjects as canCreateTenantProjectsPolicy,
  tenantScopeForbidden as tenantScopeDenied,
} from "./lib/hosted-saas-policy.js";
import {
  encryptWebhookSecret,
  getWebhookEncryptionKey,
  resolveWebhookSigningSecret,
  signWebhookPayload,
  webhookRequiresSigningSecret,
} from "./lib/webhook-signing.js";
import { dispatchStripeWebhookRoutes } from "./routes/billing-stripe-http.js";
import { base64urlEncode } from "./lib/jwt-auth.js";
import { dispatchPublicRoutes } from "./routes/public-http.js";
import { dispatchGdprRoutes } from "./routes/gdpr-http.js";
import { dispatchBillingRoutes } from "./routes/billing-http.js";
import { dispatchMessagesAgentsRoutes } from "./routes/messages-agents-http.js";
import { dispatchRealtimeStatsRoutes } from "./routes/realtime-stats-http.js";
import { dispatchReportsWebhooksRoutes } from "./routes/reports-webhooks-http.js";
import { dispatchAdminSearchAutomationRoutes } from "./routes/admin-search-automation-http.js";
import { dispatchRoomsListExportRoutes } from "./routes/rooms-list-export-http.js";
import { dispatchRoomsMutationsRoutes } from "./routes/rooms-mutations-http.js";
import { dispatchAdminProjectsRoutes } from "./routes/admin-projects-http.js";
import { listLlmProvidersForApi } from "./lib/llm-providers.js";
import { createAgentStreamHooks } from "./lib/room-stream.js";
import {
  mapBotRowToAgent,
  upsertAgentFromBody,
  invokeMentionedAgents,
  executeAgentRun,
} from "./lib/agent-runtime.js";
import { logInfo, logError } from "./lib/worker-log.js";
import { verifyJwtAndGetContext } from "./lib/jwt-request.js";
import {
  MAX_MESSAGE_LENGTH,
  validateMessageContent,
} from "./lib/message-validation.js";
import {
  quotaResetInfo,
  extractMentions,
  extractFirstUrl,
  fetchOgPreview,
} from "./lib/message-enrichment.js";
import { attachAttachmentsToMessages } from "./lib/messages-attachments.js";
import { isRoomMember } from "./lib/room-access.js";
import {
  deliverWebhooks,
  processPendingWebhookDeliveries,
} from "./lib/webhook-delivery.js";
import {
  schedulePostMessageAutomations,
  generateRoomSummaryAndAnnounce,
} from "./lib/post-message-automations.js";
import { truncateForStorage } from "./lib/storage-utils.js";
import {
  incrementOperationalMetric,
  toMinuteBucketIso,
} from "./lib/operational-metrics.js";
import { createJsonResponder } from "./lib/http-json.js";
import { handleFetchThrownError } from "./lib/http-cors.js";

export { RoomDurableObject } from "./durable-objects/room-do.js";
export { retryDelayMsForAttempt } from "./lib/webhook-delivery.js";
export { truncateForStorage } from "./lib/storage-utils.js";

// ========== INPUT VALIDATION HELPERS ==========

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_HANDLE_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_ROOM_NAME_LENGTH = 256;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown",
  "application/json", "application/zip",
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
];
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

function isValidId(id) {
  return typeof id === "string" && VALID_ID_REGEX.test(id);
}

function isValidHandle(handle) {
  return typeof handle === "string" && VALID_HANDLE_REGEX.test(handle);
}

/** Remove HTML comments without regex (handles unclosed `<!--`). */
function stripHtmlCommentsIndex(s) {
  let out = s;
  for (let guard = 0; guard < 512; guard += 1) {
    const start = out.indexOf("<!--");
    if (start === -1) return out;
    const end = out.indexOf("-->", start + 4);
    if (end === -1) {
      out = out.slice(0, start) + out.slice(start + 4);
      continue;
    }
    out = out.slice(0, start) + out.slice(end + 3);
  }
  return out;
}

/** Remove `<...>` segments without regex (handles unclosed `<`). */
function stripHtmlTagsIndex(s) {
  let out = s;
  for (let guard = 0; guard < 512; guard += 1) {
    const open = out.indexOf("<");
    if (open === -1) return out;
    const close = out.indexOf(">", open + 1);
    if (close === -1) {
      out = out.slice(0, open) + out.slice(open + 1);
      continue;
    }
    out = out.slice(0, open) + out.slice(close + 1);
  }
  return out;
}

function sanitizeString(input, maxLength = 1024) {
  if (typeof input !== "string") return "";
  let sanitized = input.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  // XSS prevention: defense-in-depth; client must still escape on render.
  sanitized = stripHtmlCommentsIndex(sanitized);
  sanitized = stripHtmlTagsIndex(sanitized);
  sanitized = sanitized
    .replace(/\b(javascript|data|vbscript)\s*:/gi, "blocked:")
    .replace(/\0/g, "");
  return sanitized;
}

function validateRoomName(name) {
  if (typeof name !== "string") {
    return { valid: false, error: "name must be a string" };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "name cannot be empty" };
  }
  if (trimmed.length > MAX_ROOM_NAME_LENGTH) {
    return {
      valid: false,
      error: `name exceeds maximum length of ${MAX_ROOM_NAME_LENGTH} characters`,
    };
  }
  return { valid: true, name: trimmed };
}

function validateRoles(roles) {
  if (!Array.isArray(roles)) return { valid: false, error: "roles must be an array" };
  const validRoles = ["owner", "admin", "member", "guest", "mod"];
  const sanitized = roles
    .filter((r) => typeof r === "string")
    .map((r) => r.trim().toLowerCase())
    .filter((r) => validRoles.includes(r));
  if (sanitized.length === 0) {
    return { valid: true, roles: ["member"] };
  }
  return { valid: true, roles: sanitized };
}

// ========== CACHING LAYER ==========

/** Rooms list keys are per-user but invalidation is per-project (see invalidateCache on room mutations). */
export function resolveCacheVersionKey(cacheKey) {
  const roomsMatch = /^rooms:([^:]+)(?::|$)/.exec(cacheKey);
  if (roomsMatch) return `ver:rooms:${roomsMatch[1]}`;
  return `ver:${cacheKey}`;
}

async function getCachedOrFetch(env, cacheKey, fetchFn, ttlSeconds = 60) {
  if (!env.RATE_LIMIT_KV) return fetchFn();
  try {
    const versionKey = resolveCacheVersionKey(cacheKey);
    const version = await env.RATE_LIMIT_KV.get(versionKey);
    const effectiveKey = version ? `${cacheKey}:v${version}` : cacheKey;
    const cached = await env.RATE_LIMIT_KV.get(effectiveKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
  }
  const result = await fetchFn();
  try {
    const versionKey = resolveCacheVersionKey(cacheKey);
    const version = await env.RATE_LIMIT_KV.get(versionKey) || "1";
    const effectiveKey = `${cacheKey}:v${version}`;
    await env.RATE_LIMIT_KV.put(effectiveKey, JSON.stringify(result), {
      expirationTtl: ttlSeconds,
    });
  } catch {
  }
  return result;
}

async function invalidateCache(env, cacheKey) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const versionKey = resolveCacheVersionKey(cacheKey);
    const currentVersion = await env.RATE_LIMIT_KV.get(versionKey);
    const nextVersion = String(Number(currentVersion || "1") + 1);
    await env.RATE_LIMIT_KV.put(versionKey, nextVersion, { expirationTtl: 3600 });
  } catch {
  }
}

/** Normalize outbound message attachments from JSON POST body (parity with websocket path). */
function sanitizeMessageAttachments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const list = [];
  for (let i = 0; i < raw.length && list.length < MAX_ATTACHMENTS_PER_MESSAGE; i++) {
    const a = raw[i];
    if (!a || typeof a !== "object") continue;
    const url = typeof a.url === "string" ? sanitizeString(a.url, 2048).trim() : "";
    if (!url) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    const name =
      sanitizeString(String(a.name || url.split("/").pop() || "attachment"), 255) || "attachment";
    const kind =
      sanitizeString(String(a.kind || "file").replace(/[^\w.-]/gi, "").slice(0, 48), 48) ||
      "file";
    const sz = Number(a.sizeBytes);
    const sizeBytes = Number.isFinite(sz) ? Math.min(Math.max(sz, 0), 10 * 1024 * 1024) : null;
    const contentTypeRaw = typeof a.contentType === "string" ? sanitizeString(a.contentType, 128) : null;
    const contentType =
      contentTypeRaw && /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_`|~+.=-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_`|~+.=-]*$/.test(contentTypeRaw)
        ? contentTypeRaw
        : null;
    list.push({ url, name, kind, sizeBytes, contentType });
  }
  return list;
}

function validateFileUpload(file, contentType, size) {
  if (!file || !(file instanceof ArrayBuffer || file instanceof Uint8Array)) {
    return { valid: false, error: "invalid file data" };
  }
  const fileSize = size || file.byteLength;
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `file size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }
  if (!ALLOWED_FILE_TYPES.includes(contentType)) {
    return {
      valid: false,
      error: `file type ${contentType} not allowed. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`,
    };
  }
  return { valid: true, size: fileSize };
}

function getFileExtension(contentType, originalName) {
  const mimeToExt = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
    "image/webp": "webp", "application/pdf": "pdf", "text/plain": "txt",
    "text/markdown": "md", "application/json": "json", "application/zip": "zip",
  };
  if (originalName && originalName.includes(".")) {
    return originalName.split(".").pop();
  }
  return mimeToExt[contentType] || "bin";
}

function generateJwtSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // Base64 is compact and safe for storage/transport.
  return btoa(binary);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const traceId = getOrCreateTraceId(request);
    let resolvedProjectIdForMetrics = env.DEFAULT_PROJECT_ID || "default";

    // CORS: configurable allowed origins via ALLOWED_ORIGINS env var
    // Format: "https://domain1.com,https://domain2.com"
    // Fallback to "*" only in dev (not recommended for production)
    const allowedOrigins = (env.ALLOWED_ORIGINS || "*")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const requestOrigin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes("*")
      ? "*"
      : requestOrigin && allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : null;

    const cspHeader = env.CSP_ENABLED === "true"
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
      : null;

    const corsHeaders = {
      ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin } : {}),
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Trace-Id,X-Fluxy-Api-Key,X-Project-Id",
      "Access-Control-Expose-Headers": "X-Trace-Id,Retry-After",
      "X-Trace-Id": traceId,
      ...(cspHeader && { "Content-Security-Policy": cspHeader }),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    };
    const requestLogCtx = sanitizeLogContext({
      traceId,
      method: request.method,
      path: url.pathname,
      search: url.search,
    });

    const notFound = () =>
      new Response("Not found", { status: 404, headers: corsHeaders });
    const json = createJsonResponder({
      traceId,
      corsHeaders,
      onErrorStatus() {
        ctx.waitUntil(
          incrementOperationalMetric(env, {
            metricName: "requests_error",
            projectId: resolvedProjectIdForMetrics,
            value: 1,
          }).catch((err) => logError("metrics.increment_failed", err, requestLogCtx))
        );
      },
    });

    if (request.method === "OPTIONS") {
      if (requestOrigin && !corsOrigin) {
        return new Response("CORS origin not allowed", { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
    const projectId = await resolveProjectId(request, env);
    resolvedProjectIdForMetrics = projectId;
    ctx.waitUntil(
      incrementOperationalMetric(env, {
        metricName: "requests_total",
        projectId,
        value: 1,
      }).catch((err) => logError("metrics.increment_failed", err, requestLogCtx))
    );
    logInfo("request.received", {
      ...requestLogCtx,
      projectId,
    });
    ctx.waitUntil(
      processPendingWebhookDeliveries(env).catch((err) =>
        logError("webhook.process_pending_failed", err, requestLogCtx)
      )
    );
    ctx.waitUntil(
      evaluateOperationalAlerts(env, projectId).catch((err) =>
        logError("alerts.evaluate_failed", err, requestLogCtx)
      )
    );

    const publicDeps = {
      env,
      ctx,
      traceId,
      json,
      corsHeaders,
      requestLogCtx,
      verifyJwtAndGetContext,
      hasAnyRole,
      logError,
      writeAuditEvent,
      sanitizeString,
      validateFileUpload,
      getFileExtension,
      resolveProjectId,
      insertNewProject,
      isValidId,
      validateRoles,
      signJwtHs256,
      maxRoomNameLength: MAX_ROOM_NAME_LENGTH,
      projectId,
      checkAndConsumeRateLimit,
    };
    const publicRes = await dispatchPublicRoutes(request, url, publicDeps);
    if (publicRes) return publicRes;

    const requireAdminAuth = env.REQUIRE_ADMIN_AUTH !== "false";

    const routeDeps = {
      env,
      ctx,
      traceId,
      corsHeaders,
      json,
      requestLogCtx,
      verifyJwtAndGetContext,
      hasAnyRole,
      logError,
      logInfo,
      requireAdminAuth,
      projectId,
      MAX_MESSAGE_LENGTH,
      checkAndConsumeProjectQuota,
      quotaResetInfo,
      checkAndConsumeRateLimit,
      incrementOperationalMetric,
      validateMessageContent,
      isValidId,
      isValidHandle,
      validateRoles,
      validateRoomName,
      extractMentions,
      extractFirstUrl,
      fetchOgPreview,
      sanitizeMessageAttachments,
      deliverWebhooks,
      invokeMentionedAgents,
      schedulePostMessageAutomations,
      upsertAgentFromBody,
      mapBotRowToAgent,
      listLlmProvidersForApi,
      executeAgentRun,
      createAgentStreamHooks,
      isRoomMember,
      canAccessRoom,
      attachAttachmentsToMessages,
      getProjectPlan,
      getDefaultQuotaLimit,
      monthKeyUtc,
      toMinuteBucketIso,
      evaluateOperationalAlerts,
      hashWebhookSecret,
      getWebhookEncryptionKey,
      encryptWebhookSecret,
      signWebhookPayload,
      timingSafeEqual,
      processPendingWebhookDeliveries,
      escapeLike,
      canBypassRoomMembership,
      generateRoomSummaryAndAnnounce,
      getCachedOrFetch,
      invalidateCache,
      escapeCsvField,
      listProjectsForAdmin,
      insertNewProject,
      canCreateTenantProjects,
      tenantScopeForbidden,
      writeAuditEvent,
      hashApiKey,
    };

    const drMessagesAgents = await dispatchMessagesAgentsRoutes(
      request,
      url,
      routeDeps,
    );
    if (drMessagesAgents) return drMessagesAgents;

    const drRealtimeStats = await dispatchRealtimeStatsRoutes(
      request,
      url,
      routeDeps,
    );
    if (drRealtimeStats) return drRealtimeStats;

    const drReportsWebhooks = await dispatchReportsWebhooksRoutes(
      request,
      url,
      routeDeps,
    );
    if (drReportsWebhooks) return drReportsWebhooks;

    const drAdminSearchAutomation = await dispatchAdminSearchAutomationRoutes(
      request,
      url,
      routeDeps,
    );
    if (drAdminSearchAutomation) return drAdminSearchAutomation;

    const drRoomsListExport = await dispatchRoomsListExportRoutes(
      request,
      url,
      routeDeps,
    );
    if (drRoomsListExport) return drRoomsListExport;

    const privacyBillingDeps = {
      env,
      corsHeaders,
      json,
      requestLogCtx,
      verifyJwt: (req) => verifyJwtAndGetContext(req, env),
      writeAuditEvent,
      hasAnyRole,
      logError,
      logInfo,
      getProjectPlan,
      monthKeyUtc,
    };
    const gdprRes = await dispatchGdprRoutes(request, url, privacyBillingDeps);
    if (gdprRes !== null) return gdprRes;
    const billingRes = await dispatchBillingRoutes(request, url, privacyBillingDeps);
    if (billingRes !== null) return billingRes;

    const drRoomsMutations = await dispatchRoomsMutationsRoutes(
      request,
      url,
      routeDeps,
    );
    if (drRoomsMutations) return drRoomsMutations;

    const drAdminProjects = await dispatchAdminProjectsRoutes(
      request,
      url,
      routeDeps,
    );
    if (drAdminProjects) return drAdminProjects;

    const stripeRes = await dispatchStripeWebhookRoutes(request, url, routeDeps);
    if (stripeRes) return stripeRes;

    return notFound();
    } catch (err) {
      return handleFetchThrownError(err, {
        corsHeaders,
        traceId,
        logError,
        requestLogCtx,
      });
    }
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron || "";
    logInfo("scheduled.triggered", { scheduledTime: event.scheduledTime, cron });

    if (cron === "0 3 * * *" || cron === "") {
      ctx.waitUntil(purgeExpiredData(env));
    }
  },
};

async function provisionBuiltinAgents(env, projectId) {
  if (!env?.DB) return;
  const templates = await env.DB.prepare(
    "SELECT id, name, handle, provider, model, system_prompt, capabilities, tools_schema FROM builtin_agent_templates WHERE is_active = 1"
  ).all();

  const now = new Date().toISOString();
  const stmts = (templates.results || []).map((t) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO bots (id, project_id, name, handle, provider, model, system_prompt, capabilities, config, webhook_url, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      `${t.id}-${projectId}`,
      projectId,
      t.name,
      t.handle,
      t.provider,
      t.model,
      t.system_prompt,
      t.capabilities,
      null,
      null,
      null,
      null,
      t.tools_schema,
      30,
      now
    )
  );
  if (stmts.length) await env.DB.batch(stmts); // perf: N+1
}

async function purgeExpiredData(env) {
  if (!env?.DB) return;
  const now = new Date();
  const nowIso = now.toISOString();

  const policies = await env.DB.prepare(
    "SELECT project_id, data_type, retention_days, auto_purge FROM data_retention_policies WHERE auto_purge = 1"
  ).all();

  for (const policy of policies.results || []) {
    const cutoff = new Date(now.getTime() - policy.retention_days * 86400000).toISOString();

    if (policy.data_type === "messages") {
      const result = await env.DB.prepare(
        "DELETE FROM messages WHERE project_id = ? AND created_at < ? AND deleted_at IS NOT NULL"
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.messages", { projectId: policy.project_id, cutoff, changes: result.meta?.changes || 0 });
    }

    if (policy.data_type === "audit_events") {
      const result = await env.DB.prepare(
        "DELETE FROM operational_audit_events WHERE project_id = ? AND created_at < ?"
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.audit_events", { projectId: policy.project_id, cutoff, changes: result.meta?.changes || 0 });
    }

    if (policy.data_type === "agent_runs") {
      const result = await env.DB.prepare(
        "DELETE FROM agent_runs WHERE project_id = ? AND created_at < ?"
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.agent_runs", { projectId: policy.project_id, cutoff, changes: result.meta?.changes || 0 });
    }

    if (policy.data_type === "usage_monthly") {
      const result = await env.DB.prepare(
        "DELETE FROM project_usage_monthly WHERE project_id = ? AND month_key < ?"
      )
        .bind(policy.project_id, cutoff.slice(0, 7))
        .run();
      logInfo("retention.purge.usage_monthly", { projectId: policy.project_id, cutoff: cutoff.slice(0, 7), changes: result.meta?.changes || 0 });
    }

    if (policy.data_type === "webhook_deliveries") {
      const result = await env.DB.prepare(
        "DELETE FROM webhook_delivery_queue WHERE project_id = ? AND created_at < ?"
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.webhook_deliveries", { projectId: policy.project_id, cutoff, changes: result.meta?.changes || 0 });
    }

    await env.DB.prepare(
      "UPDATE data_retention_policies SET last_purged_at = ? WHERE project_id = ? AND data_type = ?"
    )
      .bind(nowIso, policy.project_id, policy.data_type)
      .run();
  }
}

// ---------- Hosted SaaS: platform vs tenant project scope ----------
function canCreateTenantProjects(adminAuth, env) {
  return canCreateTenantProjectsPolicy(adminAuth, env);
}

function tenantScopeForbidden(adminAuth, targetProjectId, env) {
  const denied = tenantScopeDenied(adminAuth, targetProjectId, env);
  if (!denied) return null;
  return json({ error: denied.error, reason: denied.reason }, { status: denied.status });
}

async function listProjectsForAdmin(env, adminAuth) {
  if (isHostedMultiTenantMode(env) && adminAuth && !isPlatformOperatorProject(adminAuth.projectId, env)) {
    const row = await env.DB.prepare(
      "SELECT id, name, created_at FROM projects WHERE id = ? LIMIT 1",
    )
      .bind(adminAuth.projectId)
      .first();
    return row ? [row] : [];
  }
  const rows = await env.DB.prepare(
    "SELECT id, name, created_at FROM projects ORDER BY created_at DESC",
  ).all();
  return rows.results || [];
}

async function insertNewProject(env, ctx, name, options = {}) {
  const { audit, traceId, requestLogCtx } = options;
  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const apiKey = `fc_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyPrefix = apiKey.slice(0, 8);
  const keyHash = await hashApiKey(apiKey);
  const jwtSecret = generateJwtSecret();
  const freeLimits = planLimitsForTier(env, "free");

  await env.DB.batch([
    env.DB.prepare("INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)").bind(
      projectId,
      name,
      now,
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO project_secrets (project_id, jwt_secret, created_at) VALUES (?, ?, ?)",
    ).bind(projectId, jwtSecret, now),
    env.DB.prepare(
      "INSERT INTO api_keys (id, project_id, secret, key_prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(apiKey, projectId, "", keyPrefix, keyHash, now),
    env.DB.prepare(
      "INSERT INTO project_plans (project_id, plan_name, billing_status, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly, pricing_version, manually_overridden, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      projectId,
      "free",
      "manual",
      freeLimits.messageLimitMonthly,
      freeLimits.agentInvokeLimitMonthly,
      freeLimits.webhookDeliveryLimitMonthly,
      env.DEFAULT_PRICING_VERSION || "v1",
      0,
      now,
      now,
    ),
  ]);

  if (audit) {
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: audit.adminAuth.projectId,
        actorUserId: audit.adminAuth.userId,
        actorRoles: audit.adminAuth.roles,
        action: "admin.project.create",
        targetType: "project",
        targetId: projectId,
        traceId: audit.traceId,
        metadata: { name, keyPrefix },
      }).catch(() => {}),
    );
  }

  ctx.waitUntil(
    provisionBuiltinAgents(env, projectId).catch((err) =>
      logError("provision_builtin_agents_failed", err, requestLogCtx),
    ),
  );

  return {
    id: projectId,
    name,
    created_at: now,
    apiKey,
    plan: await getProjectPlan(env, projectId),
  };
}

async function resolveProjectId(request, env) {
  const url = new URL(request.url);
  const headerKey = request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");
  const fallback = env.DEFAULT_PROJECT_ID || "default";
  if (!headerKey) return fallback;

  const keyHash = await hashApiKey(headerKey);
  const row = await env.DB.prepare(
    "SELECT project_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL LIMIT 1"
  )
    .bind(keyHash)
    .first();
  if (row?.project_id) return row.project_id;

  // Legacy plaintext API key fallback has been removed for security.
  // All API keys must be looked up via their SHA-256 hash.
  // If you still have plaintext keys, run a migration to hash them:
  //   UPDATE api_keys SET key_hash = sha256(secret) WHERE key_hash IS NULL;
  logInfo("auth.api_key_not_found_hash", { keyHashPrefix: keyHash.slice(0, 8) });
  return fallback;
}

function canBypassRoomMembership(roles) {
  return hasAnyRole(roles, ["owner", "admin", "moderator", "bot"]);
}

async function canAccessRoom(env, auth, roomId) {
  if (!auth?.projectId || !auth?.userId || !roomId) return false;
  if (canBypassRoomMembership(auth.roles)) {
    const room = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1"
    )
      .bind(roomId, auth.projectId)
      .first();
    return !!room?.id;
  }
  return isRoomMember(env, auth.projectId, roomId, auth.userId);
}

export function hasAnyRole(roles, allowedRoles) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((role) => allowedRoles.includes(role));
}

async function signJwtHs256(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

async function hashApiKey(apiKey) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashWebhookSecret(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`fluxy-wh:${secret}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const localRateLimitStore = new Map();

export async function checkAndConsumeRateLimit(env, options) {
  const { key, limit, windowSeconds } = options;
  if (!key || !Number.isFinite(limit) || limit <= 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const windowMs = Math.max(1, Number(windowSeconds || 60) * 1000);
  const now = Date.now();
  const allowFallback = env.RATE_LIMIT_FALLBACK_ALLOW === "true" || env.ECC_HOOK_PROFILE === "minimal";

  // Preferred path: KV-backed counter for cross-isolate consistency.
  if (env.RATE_LIMIT_KV) {
    try {
      const bucketTs = Math.floor(now / windowMs) * windowMs;
      const storageKey = `rl:${key}:${bucketTs}`;
      const existingRaw = await env.RATE_LIMIT_KV.get(storageKey);
      const existing = Number(existingRaw || "0");
      if (existing >= limit) {
        const retryAfterSeconds = Math.ceil((bucketTs + windowMs - now) / 1000);
        return { allowed: false, retryAfterSeconds };
      }
      await env.RATE_LIMIT_KV.put(storageKey, String(existing + 1), {
        expirationTtl: Math.ceil(windowMs / 1000) + 5,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (err) {
      logError("rate_limit.kv_error", err, { key, traceId: options.traceId });
      return {
        allowed: false,
        retryAfterSeconds: 5,
        reason: "kv_error",
      };
    }
  }

  // No KV binding: warn but allow unless fallback is explicitly locked down.
  if (!allowFallback) {
    logInfo("rate_limit.no_kv_denied", {
      key,
      reason: "RATE_LIMIT_KV not configured and fallback is disabled",
    });
    return { allowed: false, retryAfterSeconds: 5, reason: "kv_unavailable" };
  }

  // Fallback: module-level Map is per-isolate — only use when explicitly enabled.
  const entry = localRateLimitStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    localRateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
    };
  }
  entry.count += 1;
  localRateLimitStore.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

function escapeLike(input) {
  return input.replace(/([%_\\])/g, "\\$1");
}

// Sanitize log context to prevent sensitive data leakage
// Removes: API keys, tokens, JWT parts, email addresses, long secrets
function sanitizeLogContext(ctx) {
  if (!ctx || typeof ctx !== "object") return ctx;
  const sanitized = { ...ctx };
  const sensitiveKeys = [
    "apiKey", "api_key", "token", "secret", "password", "jwt", "auth",
    "authorization", "cookie", "session", "credential", "key",
  ];
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      const value = sanitized[key];
      if (typeof value === "string" && value.length > 8) {
        sanitized[key] = value.slice(0, 4) + "..." + value.slice(-4);
      } else if (typeof value === "string") {
        sanitized[key] = "***";
      }
    }
    // Recursively sanitize nested objects (shallow only)
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogContext(sanitized[key]);
    }
  }
  return sanitized;
}

async function evaluateOperationalAlerts(env, projectId) {
  if (!projectId) return { checkedRules: 0, triggered: 0 };
  const rulesResult = await env.DB.prepare(
    "SELECT id, metric_name, window_minutes, threshold_value, comparator, severity, cooldown_minutes FROM operational_alert_rules WHERE project_id = ? AND enabled = 1"
  )
    .bind(projectId)
    .all();
  const rules = rulesResult.results || [];
  if (!rules.length) return { checkedRules: 0, triggered: 0 };

  let triggered = 0;
  for (const rule of rules) {
    const fromBucket = toMinuteBucketIso(
      new Date(Date.now() - Number(rule.window_minutes || 5) * 60_000)
    );
    const metricRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(metric_value),0) as total FROM operational_metrics WHERE project_id = ? AND metric_name = ? AND bucket_minute >= ?"
    )
      .bind(projectId, rule.metric_name, fromBucket)
      .first();
    const observed = Number(metricRow?.total || 0);
    const threshold = Number(rule.threshold_value || 0);
    const comparator = String(rule.comparator || "gte");
    const shouldTrigger =
      comparator === "gt" ? observed > threshold : observed >= threshold;
    if (!shouldTrigger) continue;

    const recentOpen = await env.DB.prepare(
      "SELECT id, created_at FROM operational_alert_events WHERE rule_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1"
    )
      .bind(rule.id)
      .first();
    const cooldownMs = Number(rule.cooldown_minutes || 15) * 60_000;
    if (recentOpen?.created_at) {
      const elapsed = Date.now() - Date.parse(recentOpen.created_at);
      if (elapsed < cooldownMs) continue;
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const message = `${rule.metric_name} ${comparator} ${threshold} (observed ${observed} in ${rule.window_minutes}m)`;
    await env.DB.prepare(
      "INSERT INTO operational_alert_events (id, project_id, rule_id, metric_name, observed_value, threshold_value, status, severity, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL)"
    )
      .bind(
        eventId,
        projectId,
        rule.id,
        rule.metric_name,
        observed,
        threshold,
        rule.severity || "warning",
        message,
        now
      )
      .run();
    await dispatchOperationalAlertEvent(env, {
      id: eventId,
      projectId,
      ruleId: rule.id,
      metricName: rule.metric_name,
      observedValue: observed,
      thresholdValue: threshold,
      severity: rule.severity || "warning",
      message,
      createdAt: now,
    }).catch((err) =>
      logError("alerts.dispatch_failed", err, {
        projectId,
        ruleId: rule.id,
        alertEventId: eventId,
      })
    );
    triggered += 1;
  }

  return { checkedRules: rules.length, triggered };
}

async function dispatchOperationalAlertEvent(env, event) {
  const targetUrl = String(env.ALERT_DISPATCH_WEBHOOK_URL || "").trim();
  if (!targetUrl) return;
  const now = new Date().toISOString();
  const dedupeId = `alert-webhook:${event.id}:${targetUrl}`;
  const existing = await env.DB.prepare(
    "SELECT id, status FROM operational_alert_dispatches WHERE id = ?"
  )
    .bind(dedupeId)
    .first();
  if (existing?.status === "dispatched") return;

  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO operational_alert_dispatches (id, event_id, project_id, channel, target, status, attempt_count, last_http_status, last_error, created_at, updated_at, dispatched_at) VALUES (?, ?, ?, 'webhook', ?, 'pending', 0, NULL, NULL, ?, ?, NULL)"
    )
      .bind(dedupeId, event.id, event.projectId, targetUrl, now, now)
      .run();
  }

  const payload = {
    type: "operational.alert.triggered",
    source: "fluxychat-worker",
    ts: now,
    alert: {
      id: event.id,
      projectId: event.projectId,
      ruleId: event.ruleId,
      metricName: event.metricName,
      observedValue: event.observedValue,
      thresholdValue: event.thresholdValue,
      severity: event.severity,
      message: event.message,
      createdAt: event.createdAt,
    },
  };
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Event": payload.type,
      "X-Fluxy-Alert-Id": event.id,
      "X-Fluxy-Project-Id": event.projectId,
      "X-Fluxy-Dedupe-Id": dedupeId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = `http_${response.status}`;
    await env.DB.prepare(
      "UPDATE operational_alert_dispatches SET status = 'failed', attempt_count = attempt_count + 1, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
    )
      .bind(response.status, truncateForStorage(error), now, dedupeId)
      .run();
    throw new Error(`alert dispatch failed: ${error}`);
  }

  await env.DB.prepare(
    "UPDATE operational_alert_dispatches SET status = 'dispatched', attempt_count = attempt_count + 1, last_http_status = ?, last_error = NULL, updated_at = ?, dispatched_at = ? WHERE id = ?"
  )
    .bind(response.status, now, now, dedupeId)
    .run();
}

function getOrCreateTraceId(request) {
  const fromHeader = request.headers.get("X-Trace-Id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function writeAuditEvent(env, event) {
  if (!env?.DB) return;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const metadataJson =
    event.metadata && Object.keys(event.metadata).length
      ? JSON.stringify(event.metadata)
      : null;
  await env.DB.prepare(
    "INSERT INTO operational_audit_events (id, project_id, actor_user_id, actor_roles, action, target_type, target_id, trace_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      event.projectId,
      event.actorUserId || "unknown",
      Array.isArray(event.actorRoles) ? event.actorRoles.join(",") : "",
      event.action,
      event.targetType || null,
      event.targetId || null,
      event.traceId || null,
      metadataJson ? truncateForStorage(metadataJson, 4000) : null,
      now
    )
    .run();
}

/**
 * Escape a field for CSV output per RFC 4180.
 * Fields containing commas, double quotes, or newlines must be wrapped in double quotes.
 * Double quotes inside the field are escaped by doubling them.
 */
function escapeCsvField(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// RoomDurableObject lives in ./durable-objects/room-do.js (re-exported above).
