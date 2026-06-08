import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { logError } from "../lib/worker-log.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  listUserWatchlist,
  addUserWatchlistTarget,
  removeUserWatchlistTarget,
  isWatchlistTargetType,
} from "../lib/user-watchlist.js";

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function canManageUser(auth, targetUserId) {
  if (auth.userId === targetUserId) return true;
  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  return roles.includes("admin") || roles.includes("owner");
}

function parseTargetUserId(url) {
  const match = url.pathname.match(/^\/users\/([^/]+)\/watchlist$/);
  if (!match) return null;
  const targetUserId = decodeURIComponent(match[1]);
  if (!VALID_ID_REGEX.test(targetUserId)) return null;
  return targetUserId;
}

/**
 * GET/POST/DELETE /users/:userId/watchlist
 * @returns {Promise<Response|null>}
 */
export async function dispatchWatchlistRoutes(request, url, h) {
  const targetUserId = parseTargetUserId(url);
  if (!targetUserId) return null;

  const { env, json } = pickRouteDeps(h, ["env", "json"]);

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!canManageUser(auth, targetUserId)) {
    return json({ error: "forbidden" }, 403);
  }

  if (request.method === "GET") {
    const targets = await listUserWatchlist(env, auth.projectId, targetUserId);
    return json({ userId: targetUserId, targets });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const type = body.type ?? body.targetType;
    const targetId = body.targetId ?? body.id;
    if (!isWatchlistTargetType(type) || typeof targetId !== "string" || !VALID_ID_REGEX.test(targetId)) {
      return json({ error: "invalid_target" }, 400);
    }
    const result = await addUserWatchlistTarget(env, {
      projectId: auth.projectId,
      userId: targetUserId,
      type,
      targetId,
    });
    if (!result.ok) {
      return json(result, { status: 400 });
    }
    return json({ ok: true, userId: targetUserId, type, targetId });
  }

  if (request.method === "DELETE") {
    let type = url.searchParams.get("type");
    let targetId = url.searchParams.get("targetId");
    if (!type || !targetId) {
      try {
        const body = await request.json();
        type = type ?? body?.type ?? body?.targetType;
        targetId = targetId ?? body?.targetId ?? body?.id;
      } catch {
        /* ignore */
      }
    }
    if (!isWatchlistTargetType(type) || typeof targetId !== "string" || !VALID_ID_REGEX.test(targetId)) {
      return json({ error: "type_and_targetId_required" }, 400);
    }
    await removeUserWatchlistTarget(env, {
      projectId: auth.projectId,
      userId: targetUserId,
      type,
      targetId,
    });
    return json({ ok: true, userId: targetUserId, type, targetId });
  }

  return null;
}
