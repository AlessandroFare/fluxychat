/**
 * CP-002: Firebase Cloud Messaging HTTP v1 (OAuth2 service account).
 */

import { logError, logInfo } from "./worker-log.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

const tokenCache = new Map();

function base64UrlEncode(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function importPrivateKey(pem) {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export function parseServiceAccountJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getAccessToken(serviceAccount) {
  const cacheKey = serviceAccount.client_email;
  const cached = tokenCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > now + 60) return cached.token;

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await safeOutboundFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fcm_oauth_${res.status}:${text.slice(0, 120)}`);
  }

  const json = await res.json();
  const token = json.access_token;
  tokenCache.set(cacheKey, { token, expiresAt: now + Number(json.expires_in || 3300) });
  return token;
}

/**
 * Send via FCM HTTP v1 API.
 */
export async function sendFcmV1Notification(env, {
  projectId,
  serviceAccount,
  tokens,
  title,
  body,
  data = {},
}) {
  if (!serviceAccount || !tokens?.length) return { sent: 0, failed: 0 };

  const fcmProjectId = serviceAccount.project_id;
  let accessToken;
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (err) {
    logError("fcm.v1_token_failed", err, { projectId });
    return { sent: 0, failed: tokens.length };
  }

  let sent = 0;
  let failed = 0;
  const url = `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`;

  for (const token of tokens.slice(0, 100)) {
    try {
      const res = await safeOutboundFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v ?? "")]),
            ),
          },
        }),
      });
      if (res.ok) {
        sent++;
      } else {
        failed++;
        const text = await res.text().catch(() => "");
        logError("fcm.v1_send_failed", new Error(text.slice(0, 120)), {
          projectId,
          status: res.status,
        });
      }
    } catch (err) {
      failed++;
      logError("fcm.v1_send_error", err, { projectId });
    }
  }

  logInfo("fcm.v1_batch_sent", { projectId, sent, failed, total: tokens.length });
  return { sent, failed };
}
