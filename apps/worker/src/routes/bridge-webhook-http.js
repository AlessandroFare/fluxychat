import { pickRouteDeps } from "./route-http-deps.js";
import { getBridgeConfig, syncInboundMessage, recordBridgeEvent } from "../lib/bridge.js";
import { getMatrixBridge, processMatrixAppserviceTransaction, recordMatrixSyncLog, verifyMatrixAppserviceWebhook } from "../lib/matrix-bridge.js";

function parseSlackMessage(body) {
  if (body.type === "url_verification") {
    return { challenge: body.challenge };
  }
  const event = body.event;
  if (!event || event.type !== "message" || event.subtype) return null;
  return {
    externalMessageId: event.ts || event.client_msg_id || `slack_${Date.now()}`,
    externalChannelId: event.channel,
    externalUserId: event.user,
    externalUsername: event.username || event.user,
    content: event.text || "",
    timestamp: event.ts ? new Date(Number(event.ts) * 1000).toISOString() : new Date().toISOString(),
  };
}

function parseDiscordMessage(body) {
  if (!body.content && !body.message?.content) return null;
  const msg = body.message ?? body;
  return {
    externalMessageId: msg.id || `discord_${Date.now()}`,
    externalChannelId: msg.channel_id || body.channel_id,
    externalUserId: msg.author?.id || body.author?.id,
    externalUsername: msg.author?.username || "discord-user",
    content: msg.content || "",
    timestamp: msg.timestamp || new Date().toISOString(),
  };
}

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

    if (body.challenge) {
      return json({ challenge: body.challenge }, { headers: corsHeaders });
    }

    const parsed = parseSlackMessage(body);
    if (!parsed) {
      return json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    const result = await syncInboundMessage(env, {
      bridgeId,
      projectId: bridge.projectId,
      platform: bridge.platform,
      ...parsed,
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

    const parsed = parseDiscordMessage(body);
    if (!parsed) {
      return json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    const result = await syncInboundMessage(env, {
      bridgeId,
      projectId: bridge.projectId,
      platform: bridge.platform,
      ...parsed,
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
