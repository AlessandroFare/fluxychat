/**
 * Mint a short-lived guest JWT for the public demo room.
 * @param {*} env
 * @param {*} deps
 */
export async function issueDemoSession(env, deps) {
  const {
    resolveProjectId,
    isValidId,
    signJwtHs256,
    defaultProjectId = env.DEFAULT_PROJECT_ID || "default",
  } = deps;

  const roomId = (env.DEMO_ROOM_ID || "").trim();
  const apiKey = (env.DEMO_API_KEY || "").trim();
  if (!roomId || !apiKey) {
    return { ok: false, status: 404, body: { enabled: false, error: "demo_not_configured" } };
  }

  const demoUserId = (env.DEMO_USER_ID || "demo-guest").trim();
  if (!isValidId(demoUserId) || !isValidId(roomId)) {
    return { ok: false, status: 500, body: { error: "demo_misconfigured" } };
  }

  const keyRequest = new Request("https://internal/demo", {
    headers: { "X-Fluxy-Api-Key": apiKey },
  });
  const demoProjectId = await resolveProjectId(keyRequest, env);
  if (!demoProjectId || demoProjectId === defaultProjectId) {
    return { ok: false, status: 401, body: { error: "demo_api_key_invalid" } };
  }

  const room = await env.DB.prepare(
    "SELECT id FROM rooms WHERE id = ? AND project_id = ?",
  )
    .bind(roomId, demoProjectId)
    .first();
  if (!room) {
    return { ok: false, status: 404, body: { error: "demo_room_not_found" } };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
  )
    .bind(roomId, demoUserId, "guest", now)
    .run();

  const row = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ?",
  )
    .bind(demoProjectId)
    .first();
  if (!row?.jwt_secret) {
    return { ok: false, status: 500, body: { error: "demo_project_secret_missing" } };
  }

  const ttlSeconds = Math.min(
    3600,
    Math.max(300, Number(env.DEMO_TOKEN_TTL_SECONDS || 1800)),
  );
  const token = await signJwtHs256(row.jwt_secret, {
    sub: demoUserId,
    tid: demoProjectId,
    roles: ["member"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  return {
    ok: true,
    status: 200,
    body: {
      enabled: true,
      roomId,
      userId: demoUserId,
      token,
      expiresIn: ttlSeconds,
      readOnly: env.DEMO_READ_ONLY === "true",
    },
  };
}
