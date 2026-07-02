/**
 * HTTP handlers: health, benchmark, uploads, platform bootstrap, auth token.
 * Runs early (before most JWT-authenticated chat routes).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { guardDemoSessionRequest } from "../lib/demo-guard.js";
import { issueDemoSession } from "../lib/demo-session.js";
import { issuePublicGuestSession } from "../lib/guest-public-session.js";
import {
  parseRoomIdFromChannelName,
  buildChannelAuthResponse,
} from "../lib/channel-auth.js";
import { clientIpFromRequest } from "../lib/client-ip.js";
import { checkAndConsumeIpRateLimit } from "../lib/ip-rate-limit.js";
import { requestSmsOtp, verifySmsOtp } from "../lib/sms-otp-auth.js";
import { isBrowserRunConfigured } from "../lib/browser-run.js";
import { getPublicHostConfig } from "../lib/custom-domains.js";
import { getClientFeatureFlags, isFlagshipConfigured } from "../lib/feature-flags.js";
import { isPlatformOperatorProject } from "../lib/hosted-saas-policy.js";
import { queryModelsCatalog, getModelById, listModelProviders, syncModelsCatalog } from "../lib/llm-models-catalog.js";

/**
 * Validate an attachment file key for R2 storage.
 * Rejects empty keys, path traversal patterns (..), leading /, and null bytes.
 * @param {string} fileKey
 * @returns {boolean}
 */
function isValidAttachmentKey(fileKey) {
  if (!fileKey || fileKey === "") return false;
  if (fileKey.includes("..")) return false;
  if (fileKey.startsWith("/")) return false;
  // Reject null bytes (\x00 / %00) to prevent path injection in Workers KV/R2
  // Check both the actual null byte character and URL-encoded form (%00)
  if (fileKey.includes("\x00") || fileKey.includes("%00")) return false;
  return true;
}

export async function dispatchPublicRoutes(request, url, h) {
  const {
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
    maxRoomNameLength,
    projectId,
    checkAndConsumeRateLimit,
    canAccessRoom,
    customDomain,
    timingSafeEqual,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "traceId",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "writeAuditEvent",
    "sanitizeString",
    "validateFileUpload",
    "getFileExtension",
    "resolveProjectId",
    "insertNewProject",
    "isValidId",
    "validateRoles",
    "signJwtHs256",
    "maxRoomNameLength",
    "projectId",
    "checkAndConsumeRateLimit",
    "canAccessRoom",
    "customDomain",
    "timingSafeEqual",
  ]);

  if (url.pathname === "/client/feature-flags" && request.method === "GET") {
    let context = {};
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (auth) {
      context = {
        userId: auth.userId,
        projectId: auth.projectId,
        email: auth.email,
      };
    }
    const flags = await getClientFeatureFlags(env, context);
    return json(
      {
        flags,
        flagship: isFlagshipConfigured(env),
        reconnectBackoff:
          flags.reconnect_backoff_fluxy === true
            ? { baseBackoffMs: 1_000, maxBackoffMs: 8_000 }
            : { baseBackoffMs: 500, maxBackoffMs: 20_000 },
      },
      { headers: corsHeaders },
    );
  }

  if (url.pathname === "/llm-models/sync" && request.method === "POST") {
    const secret = request.headers.get("X-Sync-Secret");
    const expected = env.PLATFORM_BOOTSTRAP_SECRET || "dev-sync-secret";
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    const isAdmin = auth && hasAnyRole(auth.roles, ["owner", "admin"]);
    if (secret !== expected && !isAdmin) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    let result;
    try {
      result = await syncModelsCatalog(env);
    } catch (err) {
      logError("llm_models.sync_failed", err, requestLogCtx);
      return json({ error: err instanceof Error ? err.message : "sync_failed", traceId }, { status: 500 });
    }
    return json(result);
  }

  if (url.pathname === "/llm-models" && request.method === "GET") {
    const search = url.searchParams.get("search") || undefined;
    const provider = url.searchParams.get("provider") || undefined;
    const capability = url.searchParams.get("capability") || undefined;
    const id = url.searchParams.get("id") || undefined;
    if (id) {
      const model = await getModelById(env, id);
      return json(model ? { model } : { error: "not_found" }, { status: model ? 200 : 404 });
    }
    const models = await queryModelsCatalog(env, { search, provider, capability });
    return json({ models });
  }

  if (url.pathname === "/llm-models/providers" && request.method === "GET") {
    const providers = await listModelProviders(env);
    return json({ providers });
  }

  if (url.pathname === "/public/host-config" && request.method === "GET") {
    const hostname = new URL(request.url).hostname;
    const config = await getPublicHostConfig(env, hostname);
    if (!config) {
      return json({ configured: false }, { headers: corsHeaders });
    }
    return json({ configured: true, ...config }, { headers: corsHeaders });
  }

  if (url.pathname === "/health") {
    const criticalChecks = {
      database: env.DB ? "connected" : "missing",
      durableObjects: env.ROOM ? "connected" : "missing",
    };
    const optionalChecks = {
      kv: env.RATE_LIMIT_KV ? "connected" : "missing",
      r2: env.ATTACHMENTS ? "connected" : "missing",
    };
    const criticalOk = Object.values(criticalChecks).every((v) => v === "connected");
    const degraded = !env.RATE_LIMIT_KV || !env.ATTACHMENTS;
    const workflowSchedulesEnabled =
      env.WORKFLOW_SCHEDULES_ENABLED !== "false" && env.WORKFLOW_SCHEDULES_ENABLED !== "0";
    const healthData = {
      ok: criticalOk,
      degraded: degraded || undefined,
      ts: Date.now(),
      projectId,
      version: "0.2.0",
      checks: { ...criticalChecks, ...optionalChecks },
      platformBindings: {
        flagship: isFlagshipConfigured(env) ? "connected" : "env-fallback",
        browserRun: isBrowserRunConfigured(env) ? "connected" : "unavailable",
        workflowSchedules: workflowSchedulesEnabled ? "workflows" : "worker-cron",
      },
      degradedFeatures: {
        rateLimiting: env.RATE_LIMIT_KV ? "kv" : "local-fallback",
        fileStorage: env.ATTACHMENTS ? "r2" : "unavailable",
        featureFlags: isFlagshipConfigured(env) ? "flagship" : "env-fallback",
        ogPreview: isBrowserRunConfigured(env) ? "browser-run" : "html-fetch",
      },
      paymentsEnabled: Boolean(env.STRIPE_SECRET_KEY),
    };
    return json(healthData, { status: criticalOk ? 200 : 503 });
  }

  if (url.pathname === "/benchmark" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth || !hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const startTime = performance.now();
    const body = await request.json().catch(() => ({}));
    const iterations = Math.min(Number(body.iterations) || 100, 1000);

    const dbStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await env.DB.prepare("SELECT 1 as test").first();
    }
    const dbTime = performance.now() - dbStart;

    const kvStart = performance.now();
    if (env.RATE_LIMIT_KV) {
      for (let i = 0; i < iterations; i++) {
        await env.RATE_LIMIT_KV.put(`bench:${i}`, "test", { expirationTtl: 60 });
      }
    }
    const kvTime = performance.now() - kvStart;

    const totalTime = performance.now() - startTime;

    return json({
      benchmark: {
        iterations,
        totalTimeMs: totalTime.toFixed(2),
        dbAvgMs: (dbTime / iterations).toFixed(3),
        kvAvgMs: env.RATE_LIMIT_KV ? (kvTime / iterations).toFixed(3) : null,
        rps: Math.round((iterations / totalTime) * 1000),
      },
      capacity: {
        dbP95Ms: ((dbTime / iterations) * 1.5).toFixed(3),
        estimatedMaxRPS: Math.round(1000 / (dbTime / iterations)),
      },
    });
  }

  if (url.pathname === "/upload" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    const fileName = sanitizeString(
      request.headers.get("X-File-Name") || "upload",
      255
    );
    const roomId = sanitizeString(request.headers.get("X-Room-Id") || "", 128);

    const contentLength = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (contentLength > 0 && !validateFileUpload(null, contentType, contentLength).valid) {
      return json({ error: "file too large or invalid content type" }, { status: 400 });
    }

    const fileData = await request.arrayBuffer();
    const validation = validateFileUpload(fileData, contentType, fileData.byteLength);
    if (!validation.valid) {
      return json({ error: validation.error }, { status: 400 });
    }

    if (!env.ATTACHMENTS) {
      return json({ error: "file storage not configured" }, { status: 503 });
    }

    const ext = getFileExtension(contentType, fileName);
    const fileKey = `${auth.projectId}/${auth.userId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
    if (!isValidAttachmentKey(fileKey)) {
      // This should never happen with well-formed inputs, but guard against
      // unexpected null bytes in environment variables or edge cases.
      return json({ error: "invalid file key" }, { status: 400 });
    }

    try {
      await env.ATTACHMENTS.put(fileKey, fileData, {
        httpMetadata: { contentType },
        customMetadata: {
          projectId: auth.projectId,
          userId: auth.userId,
          roomId: roomId || "",
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      logError("r2.upload_failed", err, requestLogCtx);
      return json({ error: "file storage temporarily unavailable" }, { status: 503 });
    }

    const fileUrl = `${url.origin}/attachments/${fileKey}`;

    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "file.upload",
        actorUserId: auth.userId,
        targetType: "attachment",
        targetId: fileKey,
        traceId,
        metadata: { fileName, contentType, size: fileData.byteLength, roomId },
      }).catch(() => {})
    );

    return json({
      success: true,
      file: {
        key: fileKey,
        url: fileUrl,
        name: fileName,
        contentType,
        size: fileData.byteLength,
      },
    });
  }

  if (url.pathname.startsWith("/attachments/") && request.method === "GET") {
    const fileKey = url.pathname.slice("/attachments/".length);
    if (!isValidAttachmentKey(fileKey)) {
      return json({ error: "invalid file key" }, { status: 400 });
    }

    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const keyPrefix = fileKey.split("/")[0];
    // AI-generated images use "ai-images/<projectId>/..." prefix
    // Voice messages use "voice/<projectId>/..." prefix
    const knownPrefixes = new Set(["ai-images", "voice"]);
    const expectedPrefix = knownPrefixes.has(keyPrefix) ? fileKey.split("/")[1] : keyPrefix;
    if (expectedPrefix !== auth.projectId) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    if (!env.ATTACHMENTS) {
      return json({ error: "file storage not configured" }, { status: 503 });
    }

    let object;
    try {
      object = await env.ATTACHMENTS.get(fileKey);
    } catch (err) {
      logError("r2.get_failed", err, requestLogCtx);
      return json({ error: "file storage temporarily unavailable" }, { status: 503 });
    }
    if (!object) {
      return json({ error: "file not found" }, { status: 404 });
    }

    const metadata = object.httpMetadata || {};
    const customMetadata = object.customMetadata || {};
    const fileName = customMetadata.fileName || fileKey.split("/").pop() || "download";

    // Sanitize filename to remove path separators and control characters
    const safeFileName = fileName.replace(/[/\\\x00-\x1f\x7f]/g, "_");

    // Validate and sanitize the content-type
    const rawContentType = metadata.contentType || "";
    const VALID_MIME_RE = /^[a-zA-Z0-9!#$&^._+-]+\/[a-zA-Z0-9!#$&^._+-]+$/;
    const safeContentType = VALID_MIME_RE.test(rawContentType)
      ? rawContentType
      : "application/octet-stream";

    // List of known-risky MIME types that should always be served as attachment
    const RISKY_TYPES = new Set([
      "text/html",
      "text/xhtml",
      "application/xhtml+xml",
      "text/javascript",
      "application/javascript",
      "application/x-javascript",
      "text/ecmascript",
      "application/ecmascript",
      "image/svg+xml",
      "text/xml",
      "application/xml",
      "application/x-xml",
      "text/xsl",
      "application/xsl+xml",
      "application/vnd.syncml+xml",
      "application/rss+xml",
      "application/atom+xml",
      "application/soap+xml",
      "application/xhtml+xml",
      "text/markdown",
      "text/csv",
      "application/json",
      "application/ld+json",
      "application/vnd.api+json",
      "text/x-python",
    ]);

    // Safe types that can be served inline
    const SAFE_INLINE_TYPES = new Set([
      "image/",
      "video/",
      "audio/",
      "application/pdf",
      "text/plain",
      "text/css",
      "font/",
    ]);

    // Determine disposition: risky types forced to attachment; safe types inline
    const isRisky = RISKY_TYPES.has(safeContentType);
    const isSafeInline = [...SAFE_INLINE_TYPES].some((t) => safeContentType.startsWith(t));

    const headers = new Headers();
    headers.set("Content-Type", safeContentType);
    headers.set("Content-Length", object.size.toString());
    headers.set("X-Uploaded-At", customMetadata.uploadedAt || "");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");

    // CORS: allow dashboard origins to fetch attachments with auth headers
    for (const [k, v] of Object.entries(corsHeaders)) {
      headers.set(k, v);
    }

    if (isRisky || !isSafeInline) {
      // Force attachment for risky or unknown types
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeFileName}"`
      );
    } else if (isSafeInline) {
      // Allow inline for known-safe types
      headers.set(
        "Content-Disposition",
        `inline; filename="${safeFileName}"`
      );
    }

    return new Response(object.body, { headers });
  }

  if (url.pathname === "/platform/bootstrap" && request.method === "POST") {
    const secret = request.headers.get("X-Fluxy-Bootstrap-Secret")?.trim();
    const expected = env.PLATFORM_BOOTSTRAP_SECRET?.trim();
    if (!expected || !secret) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    // Audit fix C-1: use timing-safe comparison to prevent timing side-channel
    // enumeration of the bootstrap secret. The `timingSafeEqual` helper is
    // available via publicDeps.
    const equal = await timingSafeEqual(secret, expected);
    if (!equal) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const countRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM projects").first();
    const existingCount = Number(countRow?.c || 0);
    if (existingCount > 0 && env.ALLOW_PLATFORM_BOOTSTRAP !== "true") {
      return json(
        {
          error: "bootstrap_disabled",
          message: "Projects already exist. Set ALLOW_PLATFORM_BOOTSTRAP=true to force.",
        },
        { status: 409 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, maxRoomNameLength)
        : "Fluxychat Platform";
    const project = await insertNewProject(env, ctx, name, { requestLogCtx });
    return json({
      project: {
        id: project.id,
        name: project.name,
        created_at: project.created_at,
        apiKey: project.apiKey,
        plan: project.plan,
      },
      platformProjectId: project.id,
      setup: {
        HOSTED_MULTI_TENANT: "true",
        FLUXY_PLATFORM_PROJECT_ID: project.id,
        FLUXY_CONSOLE_API_KEY: project.apiKey,
        FLUXY_CONSOLE_PROJECT_ID: project.id,
      },
    });
  }

  if (url.pathname === "/platform/sanitize-plans" && request.method === "POST") {
    const secret = request.headers.get("X-Fluxy-Bootstrap-Secret")?.trim();
    const expected = env.PLATFORM_BOOTSTRAP_SECRET?.trim();
    if (!expected || !secret) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const equal = await timingSafeEqual(secret, expected);
    if (!equal) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const dryRun =
      url.searchParams.get("dryRun") === "1" ||
      url.searchParams.get("dryRun") === "true";
    const demoteUnpaid = url.searchParams.get("demoteUnpaid") !== "false";
    const limit = Number(url.searchParams.get("limit") || "10000");
    try {
      const { sanitizeProjectPlans } = await import("../lib/sanitize-project-plans.js");
      const result = await sanitizeProjectPlans(env, { dryRun, demoteUnpaid, limit });
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: env.FLUXY_PLATFORM_PROJECT_ID || "platform",
          actorUserId: "platform_sanitize",
          actorRoles: ["admin"],
          action: dryRun ? "platform.sanitize_plans.dry_run" : "platform.sanitize_plans.apply",
          targetType: "project_plans",
          targetId: "*",
          traceId,
          metadata: {
            scanned: result.scanned,
            updated: result.updated,
            demoteUnpaid: result.demoteUnpaid,
          },
        }).catch(() => {}),
      );
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "sanitize_failed";
      logError("platform.sanitize_plans_failed", err, requestLogCtx);
      return json({ error: message }, { status: 500 });
    }
  }

  if (
    url.pathname === "/demo/session" &&
    (request.method === "GET" || request.method === "POST")
  ) {
    if (env.DEMO_ENABLED !== "true") {
      return json({ enabled: false, error: "demo_disabled" }, { status: 404 });
    }

    let turnstileToken;
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      turnstileToken =
        body && typeof body.turnstileToken === "string"
          ? body.turnstileToken
          : undefined;
    }

    const guard = await guardDemoSessionRequest(env, request, { turnstileToken });
    if (!guard.ok) {
      const headers =
        guard.retryAfterSeconds != null
          ? { "Retry-After": String(guard.retryAfterSeconds) }
          : undefined;
      return json({ error: guard.error, retryAfterSeconds: guard.retryAfterSeconds }, {
        status: guard.status,
        headers,
      });
    }

    const issued = await issueDemoSession(env, {
      resolveProjectId,
      isValidId,
      signJwtHs256,
    });
    if (!issued.ok) {
      return json(issued.body, { status: issued.status });
    }
    return json(issued.body);
  }

  const guestSessionMatch = url.pathname.match(/^\/public\/rooms\/([^/]+)\/guest-session$/);
  if (
    guestSessionMatch &&
    (request.method === "GET" || request.method === "POST")
  ) {
    const roomId = decodeURIComponent(guestSessionMatch[1]);
    if (customDomain?.projectId) {
      const roomRow = await env.DB.prepare(
        "SELECT project_id FROM rooms WHERE id = ? LIMIT 1",
      )
        .bind(roomId)
        .first();
      if (!roomRow || roomRow.project_id !== customDomain.projectId) {
        return json({ error: "room_not_in_project" }, { status: 403 });
      }
    }
    let body = null;
    if (request.method === "POST") {
      body = await request.json().catch(() => null);
    }
    const issued = await issuePublicGuestSession(
      env,
      { signJwtHs256, isValidId },
      {
        roomId,
        displayName: body?.displayName ?? body?.name,
        turnstileToken: body?.turnstileToken,
        embedParentOrigin:
          typeof body?.embedParentOrigin === "string"
            ? body.embedParentOrigin
            : undefined,
      },
      request,
    );
    if (!issued.ok) {
      return json(issued.body, { status: issued.status });
    }
    return json(issued.body);
  }

  if (url.pathname === "/auth/channel" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const socketId =
      typeof body?.socket_id === "string"
        ? body.socket_id
        : typeof body?.socketId === "string"
          ? body.socketId
          : "";
    const channelName =
      typeof body?.channel_name === "string"
        ? body.channel_name
        : typeof body?.channelName === "string"
          ? body.channelName
          : "";
    const roomId =
      (typeof body?.roomId === "string" && body.roomId) ||
      parseRoomIdFromChannelName(channelName) ||
      "";
    if (!socketId || !roomId || !isValidId(roomId)) {
      return json({ error: "socket_id and roomId (or channel_name) required" }, { status: 400 });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const presenceInfo =
      body?.channel_data && typeof body.channel_data === "object"
        ? body.channel_data.user_info ?? body.channel_data
        : body?.presenceInfo;
    const result = await buildChannelAuthResponse(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      socketId,
      roomId,
      channelName: channelName || undefined,
      presenceInfo:
        presenceInfo && typeof presenceInfo === "object" ? presenceInfo : undefined,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 500 });
    }
    return json(result);
  }

  if (
    (url.pathname === "/auth/token" || url.pathname === "/auth/signin") &&
    request.method === "POST"
  ) {
    const isSignin = url.pathname === "/auth/signin";
    const apiKey =
      request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");
    if (!apiKey) {
      return json({ error: "api key required" }, { status: 401 });
    }

    const ip = clientIpFromRequest(request);
    const keyFingerprint = `${apiKey.length}:${apiKey.slice(0, 12)}`;
    const tokenRate = await checkAndConsumeIpRateLimit(env, {
      request,
      scope: `auth-token:${keyFingerprint}`,
      limit: Number(env.RATE_LIMIT_AUTH_TOKEN_PER_MINUTE || 30),
      windowSeconds: 60,
    });
    if (!tokenRate.allowed) {
      return json(
        {
          error: "rate_limit_exceeded",
          retryAfterSeconds: tokenRate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(tokenRate.retryAfterSeconds) },
        },
      );
    }

    const resolvedProjectId = await resolveProjectId(request, env);
    if (!resolvedProjectId || resolvedProjectId === (env.DEFAULT_PROJECT_ID || "default")) {
      return json({ error: "invalid api key" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body?.userId || !isValidId(body.userId)) {
      return json(
        { error: "userId required: must be 1-128 chars, alphanumeric with _ -" },
        { status: 400 }
      );
    }
    // Audit fix M-5: cap to non-elevated roles on the public token-mint path,
    // UNLESS the caller is the platform operator (trusted server-side bootstrap key).
    const capForTenant = isPlatformOperatorProject(resolvedProjectId, env) ? false : true;
    const rolesValidation = validateRoles(body.roles, { capElevated: capForTenant });
    const roles = rolesValidation.roles;
    const ttlSeconds = Math.max(60, Math.min(Number(body.ttlSeconds || 3600), 86_400));
    const row = await env.DB.prepare(
      "SELECT jwt_secret FROM project_secrets WHERE project_id = ?"
    )
      .bind(resolvedProjectId)
      .first();
    if (!row?.jwt_secret) {
      return json({ error: "project secret not configured", projectId: resolvedProjectId, debug: "no_secret_row" }, { status: 400 });
    }
    const token = await signJwtHs256(row.jwt_secret, {
      sub: body.userId,
      tid: resolvedProjectId,
      roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
    const base = {
      token,
      expiresIn: ttlSeconds,
      claims: { sub: body.userId, tid: resolvedProjectId, roles },
    };
    if (!isSignin) {
      return json(base);
    }
    const encodedUser = encodeURIComponent(body.userId);
    return json({
      ...base,
      signin: true,
      userId: body.userId,
      projectId: resolvedProjectId,
      userChannel: {
        websocketPath: `/ws/user/${encodedUser}`,
        eventsPath: `/users/${encodedUser}/events`,
      },
    });
  }

  if (
    (url.pathname === "/auth/sms-otp/send" || url.pathname === "/auth/sms-otp/request") &&
    request.method === "POST"
  ) {
    const apiKey =
      request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");
    if (!apiKey) return json({ error: "api key required" }, { status: 401 });
    const resolvedProjectId = await resolveProjectId(request, env);
    if (!resolvedProjectId || resolvedProjectId === (env.DEFAULT_PROJECT_ID || "default")) {
      return json({ error: "invalid api key" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body?.userId || !isValidId(body.userId)) {
      return json({ error: "userId required" }, { status: 400 });
    }
    const e164 = typeof body.e164 === "string" ? body.e164.trim() : "";
    const result = await requestSmsOtp(env, request, {
      projectId: resolvedProjectId,
      userId: body.userId,
      e164,
    });
    if (!result.ok) {
      return json(
        { error: result.error, detail: result.detail, retryAfterSeconds: result.retryAfterSeconds },
        { status: result.status || 500 },
      );
    }
    return json(result);
  }

  if (url.pathname === "/auth/sms-otp/verify" && request.method === "POST") {
    const apiKey =
      request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");
    if (!apiKey) return json({ error: "api key required" }, { status: 401 });
    const resolvedProjectId = await resolveProjectId(request, env);
    if (!resolvedProjectId || resolvedProjectId === (env.DEFAULT_PROJECT_ID || "default")) {
      return json({ error: "invalid api key" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body?.userId || !isValidId(body.userId)) {
      return json({ error: "userId required" }, { status: 400 });
    }
    const e164 = typeof body.e164 === "string" ? body.e164.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const verified = await verifySmsOtp(env, {
      projectId: resolvedProjectId,
      userId: body.userId,
      e164,
      code,
    });
    if (!verified.ok) {
      return json({ error: verified.error }, { status: verified.status || 401 });
    }
    const row = await env.DB.prepare(
      "SELECT jwt_secret FROM project_secrets WHERE project_id = ?",
    )
      .bind(resolvedProjectId)
      .first();
    if (!row?.jwt_secret) {
      return json({ error: "project secret not configured" }, { status: 400 });
    }
    // Audit fix M-5: cap to non-elevated roles on the public token-mint path,
    // UNLESS the caller is the platform operator (trusted server-side bootstrap key).
    const capForTenant = isPlatformOperatorProject(resolvedProjectId, env) ? false : true;
    const rolesValidation = validateRoles(body.roles, { capElevated: capForTenant });
    const roles = rolesValidation.roles;
    const ttlSeconds = Math.max(60, Math.min(Number(body.ttlSeconds || 3600), 86_400));
    const token = await signJwtHs256(row.jwt_secret, {
      sub: body.userId,
      tid: resolvedProjectId,
      roles,
      sms_verified: e164,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
    return json({
      token,
      expiresIn: ttlSeconds,
      verified: true,
      e164,
      claims: { sub: body.userId, tid: resolvedProjectId, roles, sms_verified: e164 },
    });
  }

  return null;
}
