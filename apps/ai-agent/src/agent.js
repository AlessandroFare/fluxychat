// Fluxychat AI Agent Service
// Receives mention webhooks, fetches context, calls LLM, posts replies

import {
  verifyWebhookSignature,
  lookupAgentConfig,
  fetchContext,
  decideMode,
  callProvider,
  postReply,
  generateServiceJWT,
} from "./handlers.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // CORS: configurable allowed origins via ALLOWED_ORIGINS env var
    // Format: "https://domain1.com,https://domain2.com"
    // Fallback to "*" only in dev (not recommended for production)
    const allowedOrigins = (env.ALLOWED_ORIGINS || "*")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const requestOrigin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins.includes("*")
        ? "*"
        : allowedOrigins[0] || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Fluxy-Event,X-Fluxy-Project-Id,X-Fluxy-Signature",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "ai-agent", ts: Date.now() }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Webhook endpoint for mention events
    if (url.pathname === "/webhooks/mention" && request.method === "POST") {
      try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);
        const headers = {
          "x-fluxy-event": request.headers.get("X-Fluxy-Event") || "",
          "x-fluxy-project-id": request.headers.get("X-Fluxy-Project-Id") || "",
          "x-fluxy-signature": request.headers.get("X-Fluxy-Signature") || "",
        };

        // Fail closed when webhook protection is enabled/configured.
        const webhookSecret = env.WEBHOOK_SECRET || env[`WEBHOOK_SECRET_${body.projectId}`];
        const requireWebhookSignature =
          String(env.REQUIRE_WEBHOOK_SIGNATURE || "true") !== "false";
        if (requireWebhookSignature && !webhookSecret) {
          return new Response(
            JSON.stringify({ error: "Webhook secret not configured" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (requireWebhookSignature && !headers["x-fluxy-signature"]) {
          return new Response(
            JSON.stringify({ error: "Missing signature" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (webhookSecret) {
          const isValid = await verifyWebhookSignature(rawBody, headers["x-fluxy-signature"], webhookSecret);
          if (!isValid) {
            return new Response(
              JSON.stringify({ error: "Invalid signature" }),
              { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        // Process mention asynchronously
        ctx.waitUntil(
          processMention(body, env).catch((err) => {
            console.error("Error processing mention", err);
          })
        );

        // Return 204 immediately (webhook accepted)
        return new Response(null, { status: 204, headers: corsHeaders });
      } catch (err) {
        console.error("Webhook handler error", err);
        return new Response(
          JSON.stringify({ error: "Internal error" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
};

/**
 * Process a mention webhook event
 */
async function processMention(webhook, env) {
  const { projectId, payload } = webhook;
  const { roomId, fromUserId, toUserIds, messageId, createdAt } = payload;

  if (!Array.isArray(toUserIds) || toUserIds.length === 0) {
    console.log("No toUserIds, ignoring");
    return;
  }

  // Process each mentioned handle
  for (const handle of toUserIds) {
    // Look up agent config for this handle
    const agent = await lookupAgentConfig(env, projectId, handle);
    if (!agent) {
      console.log(`No agent config for handle: ${handle}, ignoring`);
      continue;
    }

    // Fetch recent context from Fluxychat
    const messages = await fetchContext(env, projectId, roomId, 50);
    if (!messages || messages.length === 0) {
      console.log(`No messages found for room: ${roomId}`);
      continue;
    }

    // Find the original message
    const originalMessage = messages.find((m) => m.id === messageId);
    if (!originalMessage) {
      console.log(`Original message ${messageId} not found in context`);
      continue;
    }

    // Decide mode (chat/suggest/image)
    const mode = decideMode(originalMessage.content, agent.defaultMode);

    // Build invocation context
    const context = {
      projectId,
      roomId,
      fromUserId,
      messageId,
      mode,
      mentionHandle: handle,
      messages: messages.reverse(), // oldest first for LLM
      createdAt,
      originalContent: originalMessage.content,
    };

    // Call LLM provider
    const result = await callProvider(env, { agent, context });
    if (!result || !result.content) {
      console.error(`Provider returned no content for ${handle}`);
      continue;
    }

    // Post reply back to Fluxychat
    await postReply(env, projectId, roomId, {
      botId: agent.botId,
      content: result.content,
      replyTo: messageId,
    });

    console.log(`Successfully processed mention for ${handle} in room ${roomId}`);
  }
}
