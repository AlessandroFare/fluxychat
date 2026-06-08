/**
 * SMS OTP via Sent.dm AUTHENTICATION template (P10-S6).
 */

import { sendSentDmTemplate } from "./offline-notify-sent.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";

const E164_RE = /^\+[1-9]\d{6,14}$/;
const OTP_TTL_MS = 10 * 60_000;

function isSmsOtpEnabled(env) {
  return Boolean(
    env.SMS_OTP_ENABLED === "true" ||
      env.SMS_OTP_ENABLED === "1" ||
      (env.SENT_DM_API_KEY?.trim() && env.SENT_DM_PROFILE_ID?.trim()),
  );
}

async function hashOtp(code, projectId, userId, e164) {
  const data = new TextEncoder().encode(`${projectId}:${userId}:${e164}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtpCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/**
 * @param {*} env
 * @param {Request} request
 * @param {{ projectId: string, userId: string, e164: string }} opts
 */
export async function requestSmsOtp(env, request, opts) {
  if (!isSmsOtpEnabled(env)) {
    return { ok: false, status: 503, error: "sms_otp_disabled" };
  }
  const e164 = opts.e164?.trim();
  if (!E164_RE.test(e164)) {
    return { ok: false, status: 400, error: "invalid_e164" };
  }

  const limit = Number(env.RATE_LIMIT_SMS_OTP_PER_MINUTE || 5);
  if (limit > 0) {
    const ipRate = await checkAndConsumeIpRateLimit(env, {
      request,
      scope: `sms-otp:${opts.projectId}:${opts.userId}`,
      limit,
      windowSeconds: 60,
    });
    if (!ipRate.allowed) {
      return {
        ok: false,
        status: 429,
        error: "rate_limit_exceeded",
        retryAfterSeconds: ipRate.retryAfterSeconds,
      };
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code, opts.projectId, opts.userId, e164);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO sms_otp_codes (id, project_id, user_id, e164, code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, opts.projectId, opts.userId, e164, codeHash, expiresAt, now.toISOString())
    .run();

  const templateName =
    env.SENT_DM_OTP_TEMPLATE_NAME?.trim() ||
    env.SMS_OTP_TEMPLATE_NAME?.trim() ||
    "authentication";

  try {
    await sendSentDmTemplate(env, {
      toE164: e164,
      templateName,
      parameters: { code, otp: code },
      idempotencyKey: `otp:${opts.projectId}:${opts.userId}:${id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, error: "sent_send_failed", detail: msg.slice(0, 200) };
  }

  return {
    ok: true,
    expiresAt,
    ttlSeconds: Math.floor(OTP_TTL_MS / 1000),
    ...(env.SMS_OTP_DEBUG_CODE === "true" ? { debugCode: code } : {}),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, e164: string, code: string }} opts
 */
export async function verifySmsOtp(env, opts) {
  if (!isSmsOtpEnabled(env)) {
    return { ok: false, status: 503, error: "sms_otp_disabled" };
  }
  const e164 = opts.e164?.trim();
  const code = String(opts.code || "").trim();
  if (!E164_RE.test(e164) || !/^\d{4,8}$/.test(code)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const codeHash = await hashOtp(code, opts.projectId, opts.userId, e164);
  const row = await env.DB.prepare(
    `SELECT id, expires_at, consumed_at FROM sms_otp_codes
     WHERE project_id = ? AND user_id = ? AND e164 = ? AND code_hash = ?
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(opts.projectId, opts.userId, e164, codeHash)
    .first();

  if (!row) return { ok: false, status: 401, error: "invalid_code" };
  if (row.consumed_at) return { ok: false, status: 401, error: "code_already_used" };
  if (row.expires_at < new Date().toISOString()) {
    return { ok: false, status: 401, error: "code_expired" };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE sms_otp_codes SET consumed_at = ? WHERE id = ?",
  )
    .bind(now, row.id)
    .run();

  return { ok: true, verified: true, e164 };
}
