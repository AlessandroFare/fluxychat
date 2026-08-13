import { pickRouteDeps } from "./route-http-deps.js";
import {
  submitAnonymousFeedback,
  listAnonymousFeedbackAudit,
} from "../lib/anonymous-feedback-classifier.js";

export async function dispatchAnonymousFeedbackRoutes(request, url, h) {
  const path = url.pathname;
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
    "hasAnyRole",
  ]);

  if (path === "/anonymous-feedback" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const body = await request.json().catch(() => null);
    if (!body?.content || typeof body.content !== "string") {
      return json({ error: "content required" }, { status: 400 });
    }
    if (body.content.length > 8000) {
      return json({ error: "content_too_long" }, { status: 400 });
    }

    try {
      const result = await submitAnonymousFeedback(env, {
        projectId: auth.projectId,
        roomId: body.roomId ?? null,
        content: body.content,
      });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "submit_failed";
      return json({ error: message }, { status: 500 });
    }
  }

  if (path === "/anonymous-feedback/audit" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(auth, ["owner", "admin", "hr"])) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const limit = Number(url.searchParams.get("limit") || 50);
    const audit = await listAnonymousFeedbackAudit(env, {
      projectId: auth.projectId,
      limit,
    });
    return json({ audit, count: audit.length });
  }

  return null;
}
