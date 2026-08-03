import { pickRouteDeps } from "./route-http-deps.js";
import {
  analyzeStreamFrame,
  isVisualModerationEnabled,
  scanMessageVisualContent,
} from "../lib/visual-moderation.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";

export async function dispatchVisualModerationRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/visual-moderation")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  if (request.method === "GET" && path === "/admin/visual-moderation/status") {
    return json(
      {
        ok: true,
        enabled: isVisualModerationEnabled(env),
        llmAllowed: workerSharedLlmAllowed(env, auth.projectId),
      },
      { headers: corsHeaders },
    );
  }

  if (request.method === "POST" && path === "/admin/visual-moderation/frame") {
    const body = await request.json().catch(() => ({}));
    const roomId = String(body.roomId || "").trim();
    if (!roomId) {
      return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    }
    if (!body.imageBase64 || !String(body.imageBase64).trim()) {
      return json({ error: "imageBase64 required" }, { status: 400, headers: corsHeaders });
    }

    const result = await analyzeStreamFrame(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      eventId: body.eventId ? String(body.eventId) : undefined,
      frameIndex: body.frameIndex != null ? Number(body.frameIndex) : undefined,
      imageBase64: String(body.imageBase64),
      messageId: body.messageId != null ? Number(body.messageId) : undefined,
    });

    if (!result.ok && result.error === "visual_moderation_disabled") {
      return json(result, { status: 503, headers: corsHeaders });
    }
    if (!result.ok) {
      return json(result, { status: 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (request.method === "POST" && path === "/admin/visual-moderation/scan-message") {
    const body = await request.json().catch(() => ({}));
    const roomId = String(body.roomId || "").trim();
    const authorUserId = String(body.authorUserId || auth.userId || "").trim();
    if (!roomId || !authorUserId) {
      return json({ error: "roomId and authorUserId required" }, { status: 400, headers: corsHeaders });
    }
    const result = await scanMessageVisualContent(env, {
      projectId: auth.projectId,
      roomId,
      authorUserId,
      messageId: body.messageId != null ? Number(body.messageId) : undefined,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  return null;
}
