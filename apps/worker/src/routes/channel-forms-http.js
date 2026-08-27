import { pickRouteDeps } from "./route-http-deps.js";
import {
  dispatchStructuredForm,
  handleRcsFormWebhook,
  handleWhatsAppFormWebhook,
  listChannelFormDeliveries,
  verifyRcsWebhookSignature,
} from "../lib/channel-structured-forms.js";

export async function dispatchChannelFormsRoutes(request, url, h) {
  const path = url.pathname;

  const isWebhook =
    path === "/webhooks/channel-forms/whatsapp" || path === "/webhooks/channel-forms/rcs";
  const isAdmin = path.startsWith("/admin/channel-forms");

  if (!isWebhook && !isAdmin) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
    projectId: defaultProjectId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
    "projectId",
  ]);

  try {
    if (path === "/webhooks/channel-forms/whatsapp") {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.trim() || "fluxychat";
        if (mode === "subscribe" && token === verifyToken && challenge) {
          return new Response(challenge, { status: 200, headers: corsHeaders });
        }
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const projectId =
          url.searchParams.get("projectId")?.trim() ||
          body?.projectId ||
          defaultProjectId ||
          env.DEFAULT_PROJECT_ID?.trim() ||
          "default";
        const result = await handleWhatsAppFormWebhook(env, body, { projectId });
        return json({ ok: true, ...result }, { headers: corsHeaders });
      }
    }

    if (path === "/webhooks/channel-forms/rcs" && request.method === "POST") {
      const raw = await request.text();
      const secret = env.RCS_WEBHOOK_SECRET?.trim();
      if (secret) {
        const signature =
          request.headers.get("X-RCS-Signature") ||
          request.headers.get("X-Twilio-Signature") ||
          request.headers.get("X-MessageBird-Signature");
        const valid = await verifyRcsWebhookSignature(secret, raw, signature);
        if (!valid) {
          return json({ error: "invalid_signature" }, { status: 401, headers: corsHeaders });
        }
      }
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
      }
      const projectId =
        url.searchParams.get("projectId")?.trim() ||
        body?.projectId ||
        defaultProjectId ||
        env.DEFAULT_PROJECT_ID?.trim() ||
        "default";
      const result = await handleRcsFormWebhook(env, body, { projectId });
      return json({ ok: true, ...result }, { headers: corsHeaders });
    }

    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/channel-forms/dispatch") {
      const body = await request.json().catch(() => ({}));
      const result = await dispatchStructuredForm(env, {
        projectId: auth.projectId,
        roomId: body.roomId,
        formId: body.formId,
        schema: body.schema,
        channel: body.channel,
        recipientE164: body.recipientE164,
        channelConfigId: body.channelConfigId,
        createdBy: auth.userId,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/channel-forms/deliveries") {
      const deliveries = await listChannelFormDeliveries(env, {
        projectId: auth.projectId,
        roomId: url.searchParams.get("roomId") ?? undefined,
        limit: Number(url.searchParams.get("limit") || "30"),
      });
      return json({ ok: true, deliveries }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("channel_forms.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
