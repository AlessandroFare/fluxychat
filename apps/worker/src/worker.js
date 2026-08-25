// fluxychat Cloudflare Worker
// - WebSocket endpoint for rooms using Durable Objects
// - D1 for message persistence
// Domain libs: ./lib/*; HTTP: ./routes/*-http.js (incl. billing-stripe-http.js ? lib/stripe-billing.js).

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
import { dispatchPublicRoutes } from "./routes/public-http.js";
import { dispatchWorkerHttpRoutes } from "./lib/worker-route-dispatch.js";
import { appendRoomAuditChainEvent } from "./lib/audit-chain.js";
import { maybeHandleDevProvision } from "./routes/dev-provision-http.js";
import { resolveProjectId } from "./lib/resolve-project-id.js";
import { provisionBuiltinAgents } from "./lib/provision-builtin-agents.js";
import { hashApiKey } from "./lib/api-key-hash.js";
import { base64urlEncode } from "./lib/jwt-auth.js";
import { listLlmProvidersForApi } from "./lib/llm-providers.js";
import { createAgentStreamHooks } from "./lib/room-stream.js";
import {
  mapBotRowToAgent,
  upsertAgentFromBody,
  invokeMentionedAgents,
  executeAgentRun,
} from "./lib/agent-runtime.js";
import { logInfo, logError } from "./lib/worker-log.js";
import { runScheduledCronJob } from "./lib/scheduled-runners.js";
import { verifyJwtAndGetContext } from "./lib/jwt-request.js";
import { isAdminAuthRequired } from "./lib/admin-auth-flag.js";
import {
  buildAllowedOriginsList,
  lookupActiveCustomDomain,
  normalizeHostname,
} from "./lib/custom-domains.js";
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
import { isRoomMember, canAccessRoom } from "./lib/room-access.js";
import {
  deliverWebhooks,
  processPendingWebhookDeliveries,
} from "./lib/webhook-delivery.js";
import {
  schedulePostMessageAutomations,
  generateRoomSummaryAndAnnounce,
} from "./lib/post-message-automations.js";
import { safeSchedulePostMessageAutomations } from "./lib/post-message-automations-safe.js";
import { truncateForStorage } from "./lib/storage-utils.js";
import {
  incrementOperationalMetric,
  toMinuteBucketIso,
} from "./lib/operational-metrics.js";
import { evaluateOperationalAlerts } from "./lib/operational-alerts.js";
import { seedDefaultAlertRules } from "./lib/seed-default-alert-rules.js";
import { createJsonResponder } from "./lib/http-json.js";
import { createHttpGateApp } from "./lib/hono-gate.js";
import { handleFetchThrownError } from "./lib/http-cors.js";
import { checkAndConsumeRateLimit } from "./lib/rate-limit.js";
import "./lib/adapter-web.js"; // P22-A2: Register web adapter on startup
import { registerMockAdapter } from "./lib/mock-adapter.js"; // P22-F11: Register mock adapter for testing
registerMockAdapter();

export { RoomDurableObject } from "./durable-objects/room-do.js";
export { UserDurableObject } from "./durable-objects/user-do.js";
export { IpRateLimiterDurableObject } from "./durable-objects/ip-rate-limiter-do.js";
export { SupergroupRouterDurableObject } from "./durable-objects/supergroup-router-do.js";
export { AgentDurableObject } from "./durable-objects/agent-do.js";
export { FluxyScheduledWorkflow } from "./workflows/fluxy-scheduled-workflow.js";
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

function validateRoles(roles, options = {}) {
  if (!Array.isArray(roles)) return { valid: false, error: "roles must be an array" };
  // Audit fix M-5: when minting tokens via the public /auth/token path
  // (API-key-authenticated), prevent callers from self-assigning elevated
  // roles. `owner`/`admin` grant project-wide mutation rights; a leaked API
  // key must not also yield an admin token. Trusted server-side minting
  // paths that legitimately need admin tokens use internal helpers directly.
  const elevateCap = options.capElevated === true;
  const validRoles = elevateCap
    ? ["member", "guest", "mod"]
    : ["owner", "admin", "member", "guest", "mod"];
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

async function workerFetch(request, env, ctx) {
    const url = new URL(request.url);
    const traceId = getOrCreateTraceId(request);
    let resolvedProjectIdForMetrics = env.DEFAULT_PROJECT_ID || "default";

    const customHostCtx = await lookupActiveCustomDomain(
      env,
      normalizeHostname(url.hostname),
    ).catch((err) => {
      logError("custom_domain.lookup_failed", err, {
        traceId,
        hostname: url.hostname,
      });
      return null;
    });

    const boundVerifyJwt = (req) =>
      verifyJwtAndGetContext(req, env, {
        expectedProjectId: customHostCtx?.projectId,
      });

    // CORS: ALLOWED_ORIGINS + per-domain origins (P12-G)
    const allowedOrigins = buildAllowedOriginsList(env, customHostCtx);
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
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Trace-Id,X-Fluxy-Api-Key,X-Project-Id,MCP-Protocol-Version,Mcp-Method,Mcp-Name,mcp-session-id",
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
    const projectId = customHostCtx?.projectId
      ? customHostCtx.projectId
      : await resolveProjectId(request, env);
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
    // P-7: webhook delivery flush is cron-driven (every 5 min via
    // `scheduled-runners.js`). Previously it was also fired on every
    // request, which caused 1 D1 read + 1 fan-out per HTTP hit under
    // load. Operators wanting faster webhook latency can lower the cron
    // interval in `wrangler.toml`.
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
      verifyJwtAndGetContext: boundVerifyJwt,
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
      customDomain: customHostCtx,
      canAccessRoom,
      checkAndConsumeRateLimit,
      timingSafeEqual,
    };
    // Dev-only provision endpoint (POST /dev/provision). 404 unless
    // ALLOW_DEV_PROVISION === "true" AND NODE_ENV is development|test.
    // Mounted before public routes so it short-circuits cleanly.
    const devRes = maybeHandleDevProvision(request, url, env);
    if (devRes) return devRes;

    const publicRes = await dispatchPublicRoutes(request, url, publicDeps);
    if (publicRes) return publicRes;

    const requireAdminAuth = isAdminAuthRequired(env);

    const routeDeps = {
      env,
      ctx,
      traceId,
      corsHeaders,
      json,
      requestLogCtx,
      verifyJwtAndGetContext: boundVerifyJwt,
      hasAnyRole,
      logError,
      logInfo,
      requireAdminAuth,
      projectId,
      customDomain: customHostCtx,
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
      safeSchedulePostMessageAutomations,
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
      signJwtHs256,
    };

    const privacyBillingDeps = {
      env,
      corsHeaders,
      json,
      requestLogCtx,
      verifyJwt: boundVerifyJwt,
      writeAuditEvent,
      hasAnyRole,
      logError,
      logInfo,
      getProjectPlan,
      monthKeyUtc,
    };

    const workerRes = await dispatchWorkerHttpRoutes(
      request,
      url,
      routeDeps,
      privacyBillingDeps,
    );
    if (workerRes) return workerRes;

    return notFound();
    } catch (err) {
      return handleFetchThrownError(err, {
        corsHeaders,
        traceId,
        logError,
        requestLogCtx,
      });
    }
}

async function workerScheduled(event, env, ctx) {
    const cron = event.cron || "";
    logInfo("scheduled.triggered", { scheduledTime: event.scheduledTime, cron });

    if (env.WORKFLOW_SCHEDULES_ENABLED !== "false" && env.WORKFLOW_SCHEDULES_ENABLED !== "0") {
      logInfo("scheduled.skipped_workflow_mode", { cron });
      return;
    }

    ctx.waitUntil(
      runScheduledCronJob(env, cron).catch((err) =>
        logError("scheduled.cron_failed", err, { cron }),
      ),
    );
}

const httpGate = createHttpGateApp(workerFetch);

export default {
  fetch: (request, env, ctx) => httpGate.fetch(request, env, ctx),
  scheduled: workerScheduled,
  async email(message, env, ctx) {
    const { handleCloudflareEmailMessage } = await import("./lib/email-inbound.js");
    try {
      const result = await handleCloudflareEmailMessage(message, env);
      if (!result.ok && result.reject === "no mailbox" && typeof message?.setReject === "function") {
        message.setReject(result.reject);
      }
    } catch (err) {
      logError("email.worker_handler_failed", err, {});
      throw err;
    }
  },
};


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
  const keyHash = await hashApiKey(apiKey, env);
  const keyHmac = keyHash; // dual-write during migration; both columns identical for new keys.
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
      "INSERT INTO api_keys (id, project_id, key_prefix, key_hash, key_hmac, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(apiKey, projectId, keyPrefix, keyHash, keyHmac, now),
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
  ctx.waitUntil(
    seedDefaultAlertRules(env, projectId).catch((err) =>
      logError("seed_default_alert_rules_failed", err, requestLogCtx),
    ),
  );
  ctx.waitUntil(
    seedDemoRoom(env, projectId).catch((err) =>
      logError("seed_demo_room_failed", err, { projectId }),
    ),
  );
  ctx.waitUntil(
    import("./lib/llm-models-catalog.js")
      .then(({ syncModelsCatalog }) => syncModelsCatalog(env))
      .catch((err) => logError("models_catalog_sync_failed", err, { projectId })),
  );

  return {
    id: projectId,
    name,
    created_at: now,
    apiKey,
    plan: await getProjectPlan(env, projectId),
  };
}

/**
 * Seed a "general" public room with one welcome message so a brand-new
 * project has something to look at (Area 5.1).
 */
async function seedDemoRoom(env, projectId) {
  const { ensureDemoRoomSeeded } = await import("./lib/demo-room-seed.js");
  const now = new Date().toISOString();
  const configuredDemoRoom = String(env.DEMO_ROOM_ID || "").trim();
  const roomIds = configuredDemoRoom
    ? ["general", configuredDemoRoom]
    : ["general"];
  for (const roomId of roomIds) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'public', ?, ?)"
    )
      .bind(roomId, projectId, roomId, now)
      .run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    )
      .bind(roomId, "fluxybot", now)
      .run();
  }
  const roomId = "general";
  // Welcome message.
  await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      projectId,
      roomId,
      "fluxybot",
      "Welcome to FluxyChat! This is your first room. Say hi 👋",
      now,
    )
    .run();

  if (configuredDemoRoom && projectId) {
    await ensureDemoRoomSeeded(env, projectId, configuredDemoRoom, "fluxybot").catch(() => {});
  }
}

function canBypassRoomMembership(roles) {
  // Audit S-2: only owner/admin can bypass room membership.
  // moderator and bot must actually be a member of the target room.
  return hasAnyRole(roles, ["owner", "admin"]);
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

async function hashWebhookSecret(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`fluxy-wh:${secret}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { checkAndConsumeRateLimit } from "./lib/rate-limit.js";

function escapeLike(input) {
  return String(input).replace(/([%_\\])/g, "\\$1");
}

// Sanitize log context to prevent sensitive data leakage
// Audit S-24: redact API keys, tokens, JWT parts, message bodies, webhook
// payloads, email bodies, raw query strings, and any PII-shaped field.
const REDACTED = "[REDACTED]";
const PII_SUMMARY_THRESHOLD = 80;

function summarizeString(value) {
  if (typeof value !== "string") return value;
  if (value.length <= PII_SUMMARY_THRESHOLD) return value;
  return `${value.slice(0, 32)}…(${value.length} chars)`;
}

function sanitizeLogContext(ctx) {
  if (!ctx || typeof ctx !== "object") return ctx;
  const sanitized = { ...ctx };
  const sensitiveKeys = [
    "apikey", "api_key", "token", "secret", "password", "jwt", "auth",
    "authorization", "cookie", "session", "credential", "key", "sig",
    "signature", "private", "private_key",
  ];
  const piiKeys = [
    "content", "body", "payload", "text", "message", "preview",
    "html", "markdown", "subject", "description",
  ];
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      const value = sanitized[key];
      if (typeof value === "string" && value.length > 8) {
        sanitized[key] = value.slice(0, 4) + "..." + value.slice(-4);
      } else if (typeof value === "string") {
        sanitized[key] = "***";
      } else {
        sanitized[key] = REDACTED;
      }
      continue;
    }
    if (piiKeys.some((pk) => lowerKey === pk || lowerKey.endsWith("_" + pk))) {
      const value = sanitized[key];
      if (typeof value === "string") {
        sanitized[key] = summarizeString(value);
      } else {
        sanitized[key] = REDACTED;
      }
      continue;
    }
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogContext(sanitized[key]);
    }
  }
  return sanitized;
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

  void appendRoomAuditChainEvent(env, {
    projectId: event.projectId,
    event: {
      type: "operational_audit",
      auditId: id,
      action: event.action,
      actorUserId: event.actorUserId,
      actorRoles: event.actorRoles,
      targetType: event.targetType,
      targetId: event.targetId,
      traceId: event.traceId,
      metadata: event.metadata,
    },
  }).catch(() => {});
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
