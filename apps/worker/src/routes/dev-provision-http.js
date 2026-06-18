/**
 * Dev-only provision endpoint (POST /dev/provision).
 *
 * Returns 404 unless BOTH:
 *   env.ALLOW_DEV_PROVISION === "true"
 *   env.NODE_ENV !== "production"
 *
 * Idempotent: if a project named "dev-local" already exists, returns its
 * most recent active API key (or mints a new one and revokes the old).
 *
 * This route MUST NOT be mounted in any production deployment. The mount
 * guard in worker.js is the only check; the wrangler secret/var for
 * ALLOW_DEV_PROVISION must never be set in production.
 */
import { hashApiKey } from "../lib/api-key-hash.js";

const DEV_PROJECT_NAME = "dev-local";
const DEV_PROJECT_ID = "dev-local";

function isDevModeEnabled(env) {
  if (!env || env.ALLOW_DEV_PROVISION !== "true") return false;
  // Audit M-1: fail closed. Use an allowlist of explicit non-prod
  // environments instead of a denylist (NODE_ENV !== "production"), so an
  // unset/misconfigured NODE_ENV cannot accidentally expose an endpoint
  // that mints API keys without auth.
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv === "development" || nodeEnv === "test";
}

function nowIso() {
  return new Date().toISOString();
}

export async function handleDevProvision(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST", "Content-Type": "text/plain" },
    });
  }

  // Read and discard the body  the route accepts no caller-controlled data.
  // Future body parameters are explicitly rejected to keep the surface minimal.
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (body && Object.keys(body).length > 0) {
        return new Response(
          JSON.stringify({ error: "no_body_allowed" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  } catch {
    // Ignore body read errors  the route does not depend on body content.
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "d1_unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Ensure the dev-local project exists.
  const existing = await env.DB.prepare(
    "SELECT id FROM projects WHERE id = ? LIMIT 1",
  )
    .bind(DEV_PROJECT_ID)
    .first();

  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
    )
      .bind(DEV_PROJECT_ID, DEV_PROJECT_NAME, nowIso())
      .run();
  }

  // 2. Revoke any active keys and mint a fresh one.
  const now = nowIso();
  const apiKey = `fc_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyPrefix = apiKey.slice(0, 8);
  const keyHash = await hashApiKey(apiKey, env);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE api_keys SET revoked_at = ? WHERE project_id = ? AND revoked_at IS NULL",
    ).bind(now, DEV_PROJECT_ID),
    env.DB.prepare(
      "INSERT INTO api_keys (id, project_id, key_prefix, key_hash, key_hmac, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(apiKey, DEV_PROJECT_ID, keyPrefix, keyHash, keyHash, now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO project_secrets (project_id, jwt_secret, created_at) VALUES (?, ?, ?)",
    ).bind(DEV_PROJECT_ID, "dev-local-jwt-secret-do-not-use-in-prod", now),
  ]);

  return new Response(
    JSON.stringify({
      projectId: DEV_PROJECT_ID,
      apiKey,
      workerUrl: "http://127.0.0.1:8787",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

/**
 * Mount guard. Returns the response (404) if dev provision is not enabled,
 * or null to fall through to the rest of the route chain.
 */
export function maybeHandleDevProvision(request, url, env) {
  if (!isDevModeEnabled(env)) return null;
  if (url.pathname !== "/dev/provision") return null;
  return handleDevProvision(request, env);
}
