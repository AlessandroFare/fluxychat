/**
 * Apple Push Notification service (APNs) — HTTP/2 provider API.
 * CP-001: ES256 JWT auth, sandbox/production hosts.
 */

import { logError, logInfo } from "./worker-log.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const APNS_PRODUCTION = "https://api.push.apple.com";
const APNS_SANDBOX = "https://api.sandbox.push.apple.com";

let cachedJwt = { token: null, expiresAt: 0, keyFingerprint: "" };

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

async function importApnsPrivateKey(pem) {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param {{ teamId: string, keyId: string, privateKeyPem: string }} creds
 */
export async function buildApnsJwt(creds) {
  const fp = `${creds.teamId}:${creds.keyId}`;
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt.token && cachedJwt.keyFingerprint === fp && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: creds.keyId }));
  const payload = base64UrlEncode(JSON.stringify({ iss: creds.teamId, iat: now }));
  const signingInput = `${header}.${payload}`;

  const key = await importApnsPrivateKey(creds.privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedJwt = { token, expiresAt: now + 3300, keyFingerprint: fp };
  return token;
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} [environment]
 */
export async function resolveApnsConfig(env, projectId, environment = "production") {
  const row = await env.DB.prepare(
    `SELECT apns_key_id, apns_team_id, apns_bundle_id, apns_private_key_pem, apns_use_sandbox
     FROM project_push_config
     WHERE project_id = ? AND environment = ?`,
  )
    .bind(projectId, environment)
    .first();

  if (row?.apns_key_id && row?.apns_team_id && row?.apns_private_key_pem && row?.apns_bundle_id) {
    return {
      keyId: row.apns_key_id,
      teamId: row.apns_team_id,
      bundleId: row.apns_bundle_id,
      privateKeyPem: row.apns_private_key_pem,
      useSandbox: row.apns_use_sandbox === 1,
    };
  }

  if (
    env.APNS_KEY_ID?.trim() &&
    env.APNS_TEAM_ID?.trim() &&
    env.APNS_PRIVATE_KEY?.trim() &&
    env.APNS_BUNDLE_ID?.trim()
  ) {
    return {
      keyId: env.APNS_KEY_ID.trim(),
      teamId: env.APNS_TEAM_ID.trim(),
      bundleId: env.APNS_BUNDLE_ID.trim(),
      privateKeyPem: env.APNS_PRIVATE_KEY.trim(),
      useSandbox: env.APNS_USE_SANDBOX === "true" || env.APNS_USE_SANDBOX === "1",
    };
  }

  return null;
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function getApnsTokensForUser(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT token FROM user_push_devices
     WHERE project_id = ? AND user_id = ? AND platform IN ('apns', 'ios')`,
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((r) => r.token).filter(Boolean);
}

/**
 * Send APNs alert to device tokens.
 * @returns {{ sent: number, failed: number, results: Array<{ token: string, status: number, reason?: string }> }}
 */
export async function sendApnsNotification(env, {
  projectId,
  tokens,
  title,
  body,
  data = {},
  environment = "production",
}) {
  const config = await resolveApnsConfig(env, projectId, environment);
  if (!config || !tokens?.length) return { sent: 0, failed: 0, results: [] };

  const jwt = await buildApnsJwt({
    teamId: config.teamId,
    keyId: config.keyId,
    privateKeyPem: config.privateKeyPem,
  });

  const host = config.useSandbox ? APNS_SANDBOX : APNS_PRODUCTION;
  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      "mutable-content": 1,
    },
    ...data,
  });

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const deviceToken of tokens.slice(0, 100)) {
    try {
      const res = await safeOutboundFetch(`${host}/3/device/${deviceToken}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": config.bundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: payload,
      });

      const reason = res.headers.get("apns-reason") || undefined;
      if (res.status === 200) {
        sent++;
        results.push({ token: deviceToken, status: 200 });
      } else {
        failed++;
        results.push({ token: deviceToken, status: res.status, reason });
        if (res.status === 410 || reason === "Unregistered") {
          await env.DB.prepare(
            `DELETE FROM user_push_devices WHERE project_id = ? AND platform IN ('apns','ios') AND token = ?`,
          )
            .bind(projectId, deviceToken)
            .run();
        }
      }
    } catch (err) {
      failed++;
      logError("apns.send_failed", err, { projectId, tokenPreview: deviceToken.slice(0, 8) });
      results.push({ token: deviceToken, status: 0, reason: String(err?.message || err) });
    }
  }

  logInfo("apns.batch_sent", { projectId, sent, failed, total: tokens.length });
  return { sent, failed, results };
}
