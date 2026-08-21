/**
 * Dev-only provision endpoint (POST /dev/provision).
 *
 * Returns 404 unless BOTH:
 *   env.ALLOW_DEV_PROVISION === "true"
 *   env.NODE_ENV is development or test
 *
 * Idempotent: if a project named "dev-local" already exists, returns its
 * most recent active API key (or mints a new one and revokes the old).
 *
 * This route MUST NOT be mounted in any production deployment. The mount
 * guard in worker.js is the only check; the wrangler secret/var for
 * ALLOW_DEV_PROVISION must never be set in production.
 */
import { hashApiKey } from "../lib/api-key-hash.js";
import { provisionBuiltinAgents } from "../lib/provision-builtin-agents.js";

const DEV_PROJECT_NAME = "dev-local";
const DEV_PROJECT_ID = "dev-local";

async function ensureDevSeedRooms(env) {
  const demoRoomId = String(env.DEMO_ROOM_ID || "public-demo-room").trim();
  const generalRoomId = `${DEV_PROJECT_ID}-general`;
  const roomIds = [generalRoomId, ...(demoRoomId ? [demoRoomId] : [])];
  const now = nowIso();
  for (const roomId of roomIds) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'public', ?, ?)",
    )
      .bind(roomId, DEV_PROJECT_ID, roomId, now)
      .run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
    )
      .bind(roomId, "fluxybot", now)
      .run();
  }
}

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

  await ensureDevSeedRooms(env);
  await provisionBuiltinAgents(env, DEV_PROJECT_ID);

  const now = nowIso();

  // 2. Idempotency: if an active (non-revoked) key already exists, do NOT
  //    revoke it. Re-running /dev/provision must not invalidate the key the
  //    caller already pasted into the dashboard .env.local. We only store the
  //    hash, so we cannot return the original plaintext; report that a key is
  //    already active so the caller reuses the one they have.
  const activeKey = await env.DB.prepare(
    "SELECT key_prefix FROM api_keys WHERE project_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
  )
    .bind(DEV_PROJECT_ID)
    .first();

  // Ensure the dev jwt secret exists regardless of the key branch.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO project_secrets (project_id, jwt_secret, created_at) VALUES (?, ?, ?)",
  )
    .bind(DEV_PROJECT_ID, "dev-local-jwt-secret-do-not-use-in-prod", now)
    .run();

  if (activeKey) {
    return new Response(
      JSON.stringify({
        projectId: DEV_PROJECT_ID,
        apiKey: null,
        keyPrefix: activeKey.key_prefix,
        reused: true,
        workerUrl: "http://127.0.0.1:8787",
        message:
          "An active API key already exists for dev-local and was kept valid. " +
          "Reuse the key from your previous provision (it was not rotated). " +
          "To force a new key, revoke the existing one first.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  }

  // 3. No active key: mint a fresh one.
  const apiKey = `fc_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyPrefix = apiKey.slice(0, 8);
  const keyHash = await hashApiKey(apiKey, env);

  await env.DB.prepare(
    "INSERT INTO api_keys (id, project_id, key_prefix, key_hash, key_hmac, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(apiKey, DEV_PROJECT_ID, keyPrefix, keyHash, keyHash, now)
    .run();

  return new Response(
    JSON.stringify({
      projectId: DEV_PROJECT_ID,
      apiKey,
      reused: false,
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
