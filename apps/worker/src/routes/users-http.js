/**
 * Users: profile CRUD + Clerk sync
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchUsersRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  // ─── POST /users/sync ───
  if (url.pathname === "/users/sync" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.clerkUserId) {
      return json({ error: "clerkUserId required" }, { status: 400 });
    }

    const clerkUserId = String(body.clerkUserId).trim();
    const displayName = body.displayName ? String(body.displayName).trim().slice(0, 256) : null;
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim().slice(0, 2048) : null;
    const email = body.email ? String(body.email).trim().slice(0, 320) : null;
    const statusEmoji = body.statusEmoji ? String(body.statusEmoji).trim().slice(0, 64) : null;
    const statusText = body.statusText ? String(body.statusText).trim().slice(0, 128) : null;
    const statusExpiration = body.statusExpiration != null ? Math.floor(Number(body.statusExpiration)) : null;

    // Use clerk-derived id as the user id (matches fluxyUserIdFromClerk)
    const userId = auth.userId;

    try {
      await env.DB.prepare(
        `INSERT INTO users (id, clerk_user_id, display_name, image_url, email, status_emoji, status_text, status_expiration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           clerk_user_id = excluded.clerk_user_id,
           display_name = COALESCE(excluded.display_name, users.display_name),
           image_url = COALESCE(excluded.image_url, users.image_url),
           email = COALESCE(excluded.email, users.email),
           status_emoji = COALESCE(excluded.status_emoji, users.status_emoji),
           status_text = COALESCE(excluded.status_text, users.status_text),
           status_expiration = COALESCE(excluded.status_expiration, users.status_expiration),
           updated_at = datetime('now')`
      )
        .bind(userId, clerkUserId, displayName, imageUrl, email, statusEmoji, statusText, statusExpiration)
        .run();
    } catch (err) {
      logError("users.sync_failed", err, { ...requestLogCtx, userId });
      return json({ error: "Failed to sync user" }, { status: 500 });
    }

    return json({ ok: true, userId });
  }

  // ─── GET /users/:id ───
  const userMatch = url.pathname.match(/^\/users\/([^/]+)$/);
  if (userMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const targetId = decodeURIComponent(userMatch[1]);
    if (!isValidId(targetId)) {
      return json({ error: "Invalid user id" }, { status: 400 });
    }

    const row = await env.DB.prepare(
      "SELECT id, clerk_user_id, display_name, image_url, email, bio, status_emoji, status_text, status_expiration, created_at, updated_at FROM users WHERE id = ?"
    )
      .bind(targetId)
      .first();

    if (!row) {
      return json({ error: "User not found" }, { status: 404 });
    }

    return json(row);
  }

  // ─── PATCH /users/:id ───
  if (userMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const targetId = decodeURIComponent(userMatch[1]);
    if (!isValidId(targetId)) {
      return json({ error: "Invalid user id" }, { status: 400 });
    }

    // Only the user themselves can update their profile
    if (targetId !== auth.userId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return json({ error: "Invalid body" }, { status: 400 });
    }

    const updates = [];
    const binds = [];
    if (body.displayName !== undefined) {
      updates.push("display_name = ?");
      binds.push(String(body.displayName).trim().slice(0, 256) || null);
    }
    if (body.bio !== undefined) {
      updates.push("bio = ?");
      binds.push(String(body.bio).trim().slice(0, 2000) || null);
    }
    if (body.imageUrl !== undefined) {
      updates.push("image_url = ?");
      binds.push(String(body.imageUrl).trim().slice(0, 2048) || null);
    }
    if (body.statusEmoji !== undefined) {
      updates.push("status_emoji = ?");
      binds.push(body.statusEmoji ? String(body.statusEmoji).trim().slice(0, 64) : null);
    }
    if (body.statusText !== undefined) {
      updates.push("status_text = ?");
      binds.push(body.statusText ? String(body.statusText).trim().slice(0, 128) : null);
    }
    if (body.statusExpiration !== undefined) {
      updates.push("status_expiration = ?");
      binds.push(body.statusExpiration != null ? Math.floor(Number(body.statusExpiration)) : null);
    }

    if (updates.length === 0) {
      return json({ error: "No updatable fields provided" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    binds.push(targetId);

    try {
      await env.DB.prepare(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
      )
        .bind(...binds)
        .run();
    } catch (err) {
      logError("users.update_failed", err, { ...requestLogCtx, userId: targetId });
      return json({ error: "Failed to update user" }, { status: 500 });
    }

    const updated = await env.DB.prepare(
      "SELECT id, clerk_user_id, display_name, image_url, email, bio, status_emoji, status_text, status_expiration, created_at, updated_at FROM users WHERE id = ?"
    )
      .bind(targetId)
      .first();

    return json(updated);
  }

  return null;
}
