import { pickRouteDeps } from "./route-http-deps.js";
import { getBridgeConfig, syncInboundMessage, recordBridgeEvent } from "../lib/bridge.js";
import {
  getMatrixBridge,
  processMatrixAppserviceTransaction,
  recordMatrixSyncLog,
  verifyMatrixAppserviceWebhook,
} from "../lib/matrix-bridge.js";
import { parseDiscordWebhookBody, parseSlackWebhookBody } from "../lib/bridge-webhook-parsers.js";

export async function dispatchBridgeWebhookRoutes(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const path = url.pathname;

  const slackMatch = path.match(/^\/webhooks\/bridge\/slack\/([^/]+)$/);
  if (slackMatch && request.method === "POST") {
    const bridgeId = decodeURIComponent(slackMatch[1]);
    const bridge = await getBridgeConfig(env, { bridgeId });
    if (!bridge || bridge.platform !== "slack") {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
    }

    const parsed = parseSlackWebhookBody(body);
    if (parsed.kind === "challenge") {
      return json({ challenge: parsed.challenge }, { headers: corsHeaders });
    }
    if (parsed.kind === "ignored") {
      return json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    const result = await syncInboundMessage(env, {
      bridgeId,
      projectId: bridge.projectId,
      platform: bridge.platform,
      externalMessageId: parsed.externalMessageId,
      externalChannelId: parsed.externalChannelId,
      externalUserId: parsed.externalUserId,
      externalUsername: parsed.externalUsername,
      content: parsed.content,
      timestamp: parsed.timestamp,
    });
    if (result.error) {
      await recordBridgeEvent(env, {
        bridgeId,
        projectId: bridge.projectId,
        eventType: "inbound_error",
        direction: "inbound",
        payload: { error: result.error, parsed },
        status: "error",
      });
      return json(result, { status: 400, headers: corsHeaders });
    }

    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  const discordMatch = path.match(/^\/webhooks\/bridge\/discord\/([^/]+)$/);
  if (discordMatch && request.method === "POST") {
    const bridgeId = decodeURIComponent(discordMatch[1]);
    const bridge = await getBridgeConfig(env, { bridgeId });
    if (!bridge || bridge.platform !== "discord") {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
    }

    const parsed = parseDiscordWebhookBody(body);
    if (parsed.kind === "ignored") {
      return json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    const result = await syncInboundMessage(env, {
      bridgeId,
      projectId: bridge.projectId,
      platform: bridge.platform,
      externalMessageId: parsed.externalMessageId,
      externalChannelId: parsed.externalChannelId,
      externalUserId: parsed.externalUserId,
      externalUsername: parsed.externalUsername,
      content: parsed.content,
      timestamp: parsed.timestamp,
    });
    if (result.error) {
      return json(result, { status: 400, headers: corsHeaders });
    }

    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  const matrixMatch = path.match(/^\/webhooks\/matrix\/([^/]+)$/);
  if (matrixMatch && request.method === "POST") {
    const bridgeId = decodeURIComponent(matrixMatch[1]);
    const bridge = await getMatrixBridge(env, { bridgeId });
    if (!bridge) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }

    const auth = await verifyMatrixAppserviceWebhook(env, request, {
      bridgeId,
      projectId: bridge.projectId,
    });
    if (!auth.ok) {
      const status = auth.error === "appservice_token_not_configured" ? 503 : 401;
      return json({ error: auth.error }, { status, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
    }

    const result = await processMatrixAppserviceTransaction(env, {
      bridgeId,
      projectId: bridge.projectId,
      transaction: body,
    });
    if (result.error) {
      await recordMatrixSyncLog(env, {
        bridgeId,
        projectId: bridge.projectId,
        eventType: "appservice_transaction",
        direction: "inbound",
        payload: {
          error: result.error,
          failedEventId: result.failedEventId,
          processed: result.processed,
          ignored: result.ignored,
        },
        status: "error",
      });
      return json(result, { status: 400, headers: corsHeaders });
    }

    return json(result, { headers: corsHeaders });
  }

  return null;
}
