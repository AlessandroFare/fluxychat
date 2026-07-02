/**
 * P22-A4: Adapter catalog HTTP routes.
 * GET /adapters - List all adapters
 * GET /adapters/:slug - Get adapter details
 * GET /adapters/:slug/validate - Validate adapter env vars
 * POST /adapters/:slug/test - Test adapter connection
 */

import { pickRouteDeps } from "./route-http-deps.js";
import {
  ADAPTER_CATALOG,
  getAdapterInfo,
  listAdapterCatalog,
  validateAdapterEnv,
} from "../lib/adapter-catalog.js";
import { getAdapter, listAdapters } from "../lib/adapter.js";

export async function dispatchAdaptersRoutes(request, url, h) {
  const { env, json, corsHeaders, verifyJwtAndGetContext, logError, requestLogCtx } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);

  // GET /adapters - List all adapters with their status
  if (url.pathname === "/adapters" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const adapters = ADAPTER_CATALOG.map((info) => {
      const validation = validateAdapterEnv(info.slug, env);
      const registered = !!getAdapter(info.slug);
      return {
        ...info,
        registered,
        available: validation.ok,
        missingEnvVars: validation.missing || [],
      };
    });

    return json({ adapters });
  }

  // GET /adapters/:slug - Get single adapter details
  const slugMatch = url.pathname.match(/^\/adapters\/([^/]+)$/);
  if (slugMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const slug = slugMatch[1];
    const info = getAdapterInfo(slug);
    if (!info) {
      return json({ error: "adapter_not_found" }, { status: 404 });
    }

    const validation = validateAdapterEnv(slug, env);
    const registered = !!getAdapter(slug);

    return json({
      adapter: {
        ...info,
        registered,
        available: validation.ok,
        missingEnvVars: validation.missing || [],
      },
    });
  }

  // GET /adapters/:slug/validate - Validate adapter env vars
  const validateMatch = url.pathname.match(/^\/adapters\/([^/]+)\/validate$/);
  if (validateMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const slug = validateMatch[1];
    const info = getAdapterInfo(slug);
    if (!info) {
      return json({ error: "adapter_not_found" }, { status: 404 });
    }

    const validation = validateAdapterEnv(slug, env);
    return json({
      slug,
      valid: validation.ok,
      missingEnvVars: validation.missing || [],
      requiredEnvVars: info.envVars,
      optionalEnvVars: info.optionalEnvVars,
    });
  }

  // POST /adapters/:slug/test - Test adapter connection
  const testMatch = url.pathname.match(/^\/adapters\/([^/]+)\/test$/);
  if (testMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const slug = testMatch[1];
    const adapter = getAdapter(slug);
    if (!adapter) {
      return json({ error: "adapter_not_registered" }, { status: 404 });
    }

    const validation = validateAdapterEnv(slug, env);
    if (!validation.ok) {
      return json({
        ok: false,
        error: "missing_env_vars",
        missing: validation.missing,
      });
    }

    try {
      const health = await adapter.healthCheck({
        env,
        ctx: { waitUntil: () => {} },
        projectId: auth.projectId,
        channelId: "",
        channelConfig: {},
      });
      return json({ ok: health.healthy, detail: health.detail });
    } catch (err) {
      logError("adapter.health_check_failed", err, { ...requestLogCtx, adapter: slug });
      return json({ ok: false, error: String(err?.message || err) });
    }
  }

  return null;
}
