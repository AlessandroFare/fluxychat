/**
 * HTTP handlers: health, benchmark, uploads, platform bootstrap, auth token.
 * Runs early (before most JWT-authenticated chat routes).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

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
  ]);

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
    const healthData = {
      ok: criticalOk,
      degraded: degraded || undefined,
      ts: Date.now(),
      projectId,
      version: "0.2.0",
      checks: { ...criticalChecks, ...optionalChecks },
      degradedFeatures: {
        rateLimiting: env.RATE_LIMIT_KV ? "kv" : "local-fallback",
        fileStorage: env.ATTACHMENTS ? "r2" : "unavailable",
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
    if (!fileKey || fileKey.includes("..") || fileKey.startsWith("/")) {
      return json({ error: "invalid file key" }, { status: 400 });
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

    const headers = new Headers();
    headers.set("Content-Type", metadata.contentType || "application/octet-stream");
    headers.set("Content-Length", object.size.toString());
    headers.set("X-Uploaded-At", customMetadata.uploadedAt || "");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, { headers });
  }

  if (url.pathname === "/platform/bootstrap" && request.method === "POST") {
    const secret = request.headers.get("X-Fluxy-Bootstrap-Secret")?.trim();
    const expected = env.PLATFORM_BOOTSTRAP_SECRET?.trim();
    if (!expected || !secret || secret !== expected) {
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
    if (!expected || !secret || secret !== expected) {
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

  if (url.pathname === "/auth/token" && request.method === "POST") {
    const apiKey =
      request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");
    if (!apiKey) {
      return json({ error: "api key required" }, { status: 401 });
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
    const rolesValidation = validateRoles(body.roles);
    const roles = rolesValidation.roles;
    const ttlSeconds = Math.max(60, Math.min(Number(body.ttlSeconds || 3600), 86_400));
    const row = await env.DB.prepare(
      "SELECT jwt_secret FROM project_secrets WHERE project_id = ?"
    )
      .bind(resolvedProjectId)
      .first();
    if (!row?.jwt_secret) {
      return json({ error: "project secret not configured" }, { status: 400 });
    }
    const token = await signJwtHs256(row.jwt_secret, {
      sub: body.userId,
      tid: resolvedProjectId,
      roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
    return json({
      token,
      expiresIn: ttlSeconds,
      claims: { sub: body.userId, tid: resolvedProjectId, roles },
    });
  }

  return null;
}
