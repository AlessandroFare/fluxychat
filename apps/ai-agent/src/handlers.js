// Handler functions for AI Agent Service

/**
 * Timing-safe comparison for HMAC signatures.
 * Normalizes both inputs to 32-byte SHA-256 digests before comparing
 * to eliminate any timing oracle from length mismatch.
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function timingSafeEqual(a, b) {
  const normalizedA = new TextEncoder().encode(a);
  const normalizedB = new TextEncoder().encode(b);
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", normalizedA),
    crypto.subtle.digest("SHA-256", normalizedB),
  ]);
  const aBytes = new Uint8Array(hashA);
  const bBytes = new Uint8Array(hashB);
  let result = 0;
  for (let i = 0; i < 32; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

/**
 * Module-level JWT cache per projectId.
 * Caches the current JWT and its expiry timestamp to avoid re-minting on every call.
 * Resets when the Worker instance restarts (expected; cache is best-effort).
 * @type {Map<string, { jwt: string, expiresAt: number }>}
 */
const jwtCache = new Map();

const JWT_TTL_SECONDS = 55 * 60;
const JWT_REFRESH_BUFFER_SECONDS = 5 * 60;

async function getServiceJWT(env, projectId) {
  const cached = jwtCache.get(projectId);
  const nowSecs = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > nowSecs + JWT_REFRESH_BUFFER_SECONDS) {
    return cached.jwt;
  }
  let newJWT;
  try {
    newJWT = await generateServiceJWT(env, projectId);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "jwt.refresh_failed",
        projectId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    throw err;
  }
  let expiresAt = nowSecs + JWT_TTL_SECONDS;
  try {
    const expPayload = newJWT.split(".")[1];
    const payload = JSON.parse(atob(expPayload.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload?.exp) expiresAt = payload.exp;
  } catch {
    // fall through to TTL-derived expiry
  }
  jwtCache.set(projectId, { jwt: newJWT, expiresAt });
  return newJWT;
}

export async function verifyWebhookSignature(body, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedHex = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );

  const actualHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return await timingSafeEqual(actualHex, expectedHex);
}

/**
 * Look up agent configuration for a project + handle
 * Supports multiple lookup strategies:
 * 1. KV namespace (if AGENT_CONFIG_KV is set)
 * 2. Environment variables (AGENT_<projectId>_<handle>_*)
 * 3. Hardcoded configs (for development)
 */
export async function lookupAgentConfig(env, projectId, handle) {
  // Strategy 0: D1 database lookup from bots table (most reliable for builtin agents)
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        "SELECT id, name, handle, provider, model, system_prompt, capabilities, tools_schema FROM bots WHERE project_id = ? AND handle = ? LIMIT 1"
      ).bind(projectId, handle).first();
      if (row) {
        return {
          projectId,
          handle: row.handle,
          botId: row.id,
          provider: row.provider || "openai",
          model: row.model || "gpt-4o-mini",
          defaultMode: "chat",
          capabilities: (row.capabilities || "chat").split(",").map((s) => s.trim()),
          systemPrompt: row.system_prompt,
          apiKey: null,
          toolsSchema: row.tools_schema ? JSON.parse(row.tools_schema) : null,
        };
      }
    } catch (err) {
      console.error("D1 agent lookup failed", err);
    }
  }

  // Strategy 1: KV namespace
  if (env.AGENT_CONFIG_KV) {
    const key = `${projectId}:${handle}`;
    const value = await env.AGENT_CONFIG_KV.get(key, "json");
    if (value) {
      return value;
    }
  }

  // Strategy 2: Environment variables
  const prefix = `AGENT_${projectId.replace(/[^a-zA-Z0-9]/g, "_")}_${handle.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const botId = env[`${prefix}_BOT_ID`];
  const provider = env[`${prefix}_PROVIDER`];
  const model = env[`${prefix}_MODEL`];
  const defaultMode = env[`${prefix}_MODE`] || "chat";
  const capabilitiesStr = env[`${prefix}_CAPABILITIES`] || "chat";
  const systemPrompt = env[`${prefix}_SYSTEM_PROMPT`];
  const apiKey = env[`${prefix}_API_KEY`];

  if (botId && provider && model) {
    return {
      projectId,
      handle,
      botId,
      provider,
      model,
      defaultMode,
      capabilities: capabilitiesStr.split(",").map((s) => s.trim()),
      systemPrompt,
      apiKey,
    };
  }

  // Strategy 3: Default OpenAI config for development (if OPENAI_API_KEY is set)
  if (handle === "chatgpt" && env.OPENAI_API_KEY) {
    return {
      projectId,
      handle: "chatgpt",
      botId: env.CHATGPT_BOT_ID || "bot_chatgpt",
      provider: "openai",
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      defaultMode: "chat",
      capabilities: ["chat"],
      systemPrompt: env.OPENAI_SYSTEM_PROMPT || "You are a helpful assistant in a chat application.",
      apiKey: env.OPENAI_API_KEY,
    };
  }

  return null;
}

/**
 * Fetch recent messages from Fluxychat API
 */
export async function fetchContext(env, projectId, roomId, limit = 50) {
  const baseUrl = env.FLUXY_BASE_URL || "http://127.0.0.1:8787";
  const url = `${baseUrl}/api/messages?roomId=${encodeURIComponent(roomId)}&limit=${limit}`;
  const jwt = await getServiceJWT(env, projectId);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch context: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.messages || [];
  } catch (err) {
    console.error("Error fetching context", err);
    return null;
  }
}

/**
 * Decide agent mode based on message content
 */
export function decideMode(content, defaultMode) {
  if (content.startsWith("/image ")) return "image";
  if (content.startsWith("/suggest ")) return "suggest";
  return defaultMode;
}

/**
 * Call LLM provider (OpenAI, Anthropic, etc.)
 */
export async function callProvider(env, { agent, context }) {
  const { provider, model, systemPrompt, apiKey } = agent;
  const apiKeyToUse = apiKey || env.OPENAI_API_KEY || env[`${provider.toUpperCase()}_API_KEY`];

  if (!apiKeyToUse) {
    throw new Error(`No API key found for provider: ${provider}`);
  }

  switch (provider) {
    case "openai":
    case "azure-openai":
      return await callOpenAI(env, { agent, context, apiKey: apiKeyToUse });
    case "anthropic":
      return await callAnthropic(env, { agent, context, apiKey: apiKeyToUse });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAI(env, { agent, context, apiKey }) {
  const { model, systemPrompt } = agent;
  const baseUrl = env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  // Build messages array from context
  const messages = [];

  // System prompt
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Add recent conversation context (last 20 messages to avoid token limits)
  const recentMessages = context.messages.slice(-20);
  for (const msg of recentMessages) {
    const role = msg.userId === context.fromUserId ? "user" : "assistant";
    messages.push({ role, content: msg.content });
  }

  // Add the current user message if not already included
  if (context.messages.length > 0 && context.messages[context.messages.length - 1].id !== context.messageId) {
    messages.push({ role: "user", content: context.originalContent });
  }

  const body = {
    model,
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(env.OPENAI_ORG_ID ? { "OpenAI-Organization": env.OPENAI_ORG_ID } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`OpenAI API error: ${response.status} ${text}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    return { content };
  } catch (err) {
    console.error("OpenAI call error", err);
    throw err;
  }
}

/**
 * Call Anthropic Messages API
 * https://docs.anthropic.com/en/docs/about-claude/models
 */
async function callAnthropic(env, { agent, context, apiKey }) {
  const { model, systemPrompt } = agent;
  const baseUrl = env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

  // Build messages array from context (Anthropic uses alternating user/assistant roles)
  const messages = [];
  const recentMessages = context.messages.slice(-20);

  for (const msg of recentMessages) {
    const role = msg.userId === context.fromUserId ? "user" : "assistant";
    messages.push({ role, content: msg.content });
  }

  // Ensure the last message is from the user (Anthropic requirement)
  if (messages.length > 0 && messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: context.originalContent || "Please respond." });
  }

  const body = {
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages,
    ...(systemPrompt ? { system: systemPrompt } : {}),
  };

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Anthropic API error: ${response.status} ${text}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    // Anthropic returns content as an array of content blocks
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Anthropic response");
    }

    return { content };
  } catch (err) {
    console.error("Anthropic call error", err);
    throw err;
  }
}

/**
 * Post reply back to Fluxychat via /rooms/{id}/messages/from-bot
 */
export async function postReply(env, projectId, roomId, request) {
  const baseUrl = env.FLUXY_BASE_URL || "http://127.0.0.1:8787";
  const url = `${baseUrl}/rooms/${encodeURIComponent(roomId)}/messages/from-bot`;

  // Generate service JWT for authentication
  const jwt = await getServiceJWT(env, projectId);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to post reply: ${response.status} ${text}`);
      throw new Error(`Failed to post reply: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error posting reply", err);
    throw err;
  }
}

/**
 * Generate service JWT for authenticating with Fluxychat
 * Uses project-specific JWT secret from environment
 */
export async function generateServiceJWT(env, projectId) {
  // Get JWT secret for this project
  const secretKey =
    env[`JWT_SECRET_${projectId.replace(/[^a-zA-Z0-9]/g, "_")}`] || env.JWT_SECRET;
  if (!secretKey) {
    throw new Error(`Missing JWT secret for project ${projectId}`);
  }

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: "service:ai-agent",
    tid: projectId,
    roles: ["bot", "admin"],
    exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS, // 55 min TTL; caller handles refresh
    iat: Math.floor(Date.now() / 1000),
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = base64url(new Uint8Array(sig));

  return `${data}.${sigB64}`;
}

/**
 * Base64URL encode
 */
function base64url(input) {
  if (typeof input === "string") {
    input = new TextEncoder().encode(input);
  }
  // Handle Uint8Array by converting to string safely
  let binary = "";
  for (let i = 0; i < input.length; i++) {
    binary += String.fromCharCode(input[i]);
  }
  const bin = btoa(binary);
  return bin.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
