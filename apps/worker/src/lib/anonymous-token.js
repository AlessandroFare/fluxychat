/**
 * Mint anonymous JWT for SDK demo / browse mode (Portal-style POST /tokens/anonymous).
 * Authenticated by project API key only — no bearer token required.
 */

/**
 * @param {*} env
 * @param {{
 *   signJwtHs256: (secret: string, payload: object) => Promise<string>,
 *   isValidId: (id: string) => boolean,
 *   resolveProjectId: (request: Request) => Promise<string|null>,
 * }} deps
 * @param {Request} request
 * @param {{ anonId?: string, displayName?: string, ttlSeconds?: number }} [body]
 */
export async function issueAnonymousToken(env, deps, request, body = {}) {
  const { signJwtHs256, isValidId, resolveProjectId } = deps;

  const apiKey =
    request.headers.get("X-Fluxy-Api-Key") || new URL(request.url).searchParams.get("apiKey");
  if (!apiKey) {
    return { ok: false, status: 401, body: { error: "api_key_required", code: "unauthorized" } };
  }

  const projectId = await resolveProjectId(request, env);
  if (!projectId || projectId === (env.DEFAULT_PROJECT_ID || "default")) {
    return { ok: false, status: 401, body: { error: "invalid_api_key", code: "unauthorized" } };
  }

  let userId = typeof body.anonId === "string" ? body.anonId.trim() : "";
  if (userId && !isValidId(userId)) {
    return { ok: false, status: 400, body: { error: "invalid_anon_id", code: "invalid_request" } };
  }
  if (!userId) {
    userId = `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    if (!isValidId(userId)) {
      userId = `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    }
  }

  const row = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ?",
  )
    .bind(projectId)
    .first();
  if (!row?.jwt_secret) {
    return {
      ok: false,
      status: 400,
      body: { error: "project_secret_not_configured", code: "misconfigured" },
    };
  }

  const ttlSeconds = Math.max(
    300,
    Math.min(Number(body.ttlSeconds || env.ANONYMOUS_TOKEN_TTL_SECONDS || 3600), 86_400),
  );
  const nowSec = Math.floor(Date.now() / 1000);

  const token = await signJwtHs256(row.jwt_secret, {
    sub: userId,
    tid: projectId,
    roles: ["guest"],
    anon: true,
    ...(body.displayName ? { name: String(body.displayName).slice(0, 64) } : {}),
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  });

  return {
    ok: true,
    status: 200,
    body: {
      token,
      expiresIn: ttlSeconds,
      userId,
      claims: { sub: userId, tid: projectId, roles: ["guest"], anon: true },
    },
  };
}
