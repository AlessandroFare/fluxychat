/**
 * LiveKit access token minting for Cloudflare Workers (Web Crypto HS256).
 * @see https://docs.livekit.io/home/get-started/authentication/
 */

import { base64urlEncode } from "./jwt-auth.js";

/**
 * @param {string} secret
 * @param {Record<string, unknown>} payload
 */
async function signJwtHs256(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Audit F-26: TTL from the client is capped; a video token must not outlive
 * the call it belongs to by more than a few hours.
 */
export const LIVEKIT_TTL_MIN_SECONDS = 60;
export const LIVEKIT_TTL_MAX_SECONDS = 6 * 3600;

export function clampLiveKitTtl(seconds) {
  const value = Number(seconds);
  const base = Number.isFinite(value) && value > 0 ? Math.floor(value) : 3600;
  return Math.min(LIVEKIT_TTL_MAX_SECONDS, Math.max(LIVEKIT_TTL_MIN_SECONDS, base));
}

/**
 * @param {object} env
 * @param {{
 *   roomName: string,
 *   identity: string,
 *   displayName?: string,
 *   ttlSeconds?: number,
 *   canPublish?: boolean,
 *   canSubscribe?: boolean,
 * }} options
 */
export async function mintLiveKitAccessToken(env, options) {
  const apiKey = String(env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = String(env.LIVEKIT_API_SECRET || "").trim();
  const livekitUrl = String(env.LIVEKIT_URL || "").trim();

  if (!apiKey || !apiSecret) {
    return {
      error: "livekit_not_configured",
      message: "Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the Worker",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = clampLiveKitTtl(options.ttlSeconds);
  const roomName = options.roomName;
  const identity = options.identity;

  const payload = {
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + ttl,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: options.canPublish !== false,
      canSubscribe: options.canSubscribe !== false,
      canPublishData: true,
    },
  };

  if (options.displayName) {
    payload.name = options.displayName;
  }

  const token = await signJwtHs256(apiSecret, payload);

  return {
    provider: "livekit",
    token,
    url: livekitUrl || null,
    roomName,
    identity,
    expiresAt: (now + ttl) * 1000,
  };
}
