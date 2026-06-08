/**
 * Sent.dm inbound webhook + admin delivery list (P10-S2).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  verifySentDmWebhookSignature,
  handleSentDmWebhookEvent,
} from "../lib/sent-dm-deliveries.js";
import { handleTelcoInboundMessage } from "../lib/telco-inbound.js";
import {
  syncSentContactForE164,
  handleSentContactWebhookEvent,
} from "../lib/sent-dm-contacts.js";

export async function dispatchIntegrationsSentRoutes(request, url, h) {
  const { env, corsHeaders, json, verifyJwtAndGetContext, hasAnyRole, logError, isValidId } =
    pickRouteDeps(h, [
      "env",
      "corsHeaders",
      "json",
      "verifyJwtAndGetContext",
      "hasAnyRole",
      "logError",
      "isValidId",
    ]);

  if (url.pathname === "/integrations/sent/webhook" && request.method === "POST") {
    const secret = env.SENT_DM_WEBHOOK_SECRET?.trim();
    const rawBody = await request.text();
    if (secret) {
      const sig =
        request.headers.get("X-Sent-Signature") ||
        request.headers.get("X-Signature") ||
        request.headers.get("X-Webhook-Signature");
      const valid = await verifySentDmWebhookSignature(secret, rawBody, sig);
      if (!valid) {
        return json({ error: "invalid_signature" }, { status: 401 });
      }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }

    try {
      const inbound = await handleTelcoInboundMessage(env, body);
      const result = await handleSentDmWebhookEvent(env, body);
      const contact = await handleSentContactWebhookEvent(env, body);
      return json({ inbound, ...result, contact });
    } catch (err) {
      logError("sent.webhook_failed", err, {});
      return json({ error: "processing_failed" }, { status: 500 });
    }
  }

  if (url.pathname === "/admin/integrations/sent/deliveries" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const statusFilter = url.searchParams.get("status");

    let query =
      "SELECT id, room_id, fluxy_message_id, user_id, to_e164, sent_message_id, status, channel, error, created_at, updated_at FROM sent_dm_deliveries WHERE project_id = ?";
    const binds = [auth.projectId];
    if (statusFilter) {
      query += " AND status = ?";
      binds.push(statusFilter);
    }
    query += " ORDER BY created_at DESC LIMIT ?";
    binds.push(limit);

    const rows = await env.DB.prepare(query)
      .bind(...binds)
      .all();

    return json({ deliveries: rows.results || [] });
  }

  if (url.pathname === "/admin/integrations/sent/contacts" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const rows = await env.DB.prepare(
      `SELECT id, user_id, e164, sent_contact_id, opt_out, default_channel, synced_at, updated_at
       FROM sent_dm_contacts WHERE project_id = ? ORDER BY synced_at DESC LIMIT ?`,
    )
      .bind(auth.projectId, limit)
      .all();
    return json({ contacts: rows.results || [] });
  }

  if (url.pathname === "/integrations/sent/contacts/sync" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const e164 = typeof body?.e164 === "string" ? body.e164.trim() : "";
    const userId =
      typeof body?.userId === "string" && isValidId(body.userId)
        ? body.userId
        : auth.userId;
    const result = await syncSentContactForE164(env, {
      projectId: auth.projectId,
      userId,
      e164,
    });
    if (!result.ok) {
      return json({ error: result.error, detail: result.detail }, { status: result.status || 400 });
    }
    return json(result);
  }

  return null;
}
