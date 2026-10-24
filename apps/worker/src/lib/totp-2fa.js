/**
 * P18-G: TOTP-based 2FA for admin users
 * RFC 6238 compliant, uses Web Crypto API
 */

import { checkAndConsumeRateLimit } from './rate-limit.js';
import { sealSecretAtRest, openSecretAtRest } from './secrets-crypto.js';
import { timingSafeEqual } from './crypto-timing.js';

const DEFAULT_PERIOD = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_ALGORITHM = 'SHA-1';
const BACKUP_CODE_COUNT = 10;

/**
 * Generate a TOTP secret (base32 encoded)
 */
export function generateTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTotpUri(secret, email, issuer = 'FluxyChat') {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params.toString()}`;
}

/**
 * Generate QR code as SVG data URI
 * Returns a simple QR-like visual for enrollment (not a full QR library)
 * In production, you'd use a QR code library — this is a minimal fallback
 */
export function generateQrCodeDataUri(uri) {
  // Return the URI as a text-based representation
  // Dashboard should use a QR library (qrcode) to render the actual QR
  return { uri, format: 'otpauth-uri' };
}

/**
 * Generate backup codes
 */
export async function generateBackupCodes() {
  const codes = [];
  const codeHashes = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Audit #24: 80 bits of entropy (was 32). Hashed in the canonical
    // dash-less uppercase form that verifyBackupCode reconstructs.
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const canonical = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const formatted = (canonical.match(/.{5}/g) || [canonical]).join('-');
    codes.push(formatted);
    codeHashes.push(await sha256Hex(canonical));
  }

  return { codes, codeHashes };
}

/**
 * Verify a TOTP code
 * @param {string} secret - Base32-encoded TOTP secret
 * @param {string} code - 6-digit code to verify
 * @param {number} window - Allowed time steps before/after current (default 1)
 * @returns {boolean} Whether the code is valid
 */
export async function verifyTotp(secret, code, window = 1) {
  return (await verifyTotpStep(secret, code, window)).valid;
}

/**
 * Verify a TOTP code and report which time step matched.
 * Audit F-32: the caller needs the step to enforce single-use codes.
 * @param {string} secret
 * @param {string} code
 * @param {number} window
 * @returns {Promise<{ valid: boolean, timeStep: number|null }>}
 */
export async function verifyTotpStep(secret, code, window = 1) {
  const cleanCode = code.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return { valid: false, timeStep: null };

  const keyBytes = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const period = DEFAULT_PERIOD;

  for (let i = -window; i <= window; i++) {
    const timeStep = Math.floor(now / period) + i;
    const counter = new ArrayBuffer(8);
    const view = new DataView(counter);
    view.setUint32(4, timeStep, false); // Big-endian

    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const hmac = await crypto.subtle.sign('HMAC', key, counter);
    const hash = new Uint8Array(hmac);

    const offset = hash[hash.length - 1] & 0x0f;
    const otp =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const expected = String(otp % Math.pow(10, DEFAULT_DIGITS)).padStart(DEFAULT_DIGITS, '0');
    // Audit F-38: constant-time comparison (was `===`).
    if (await timingSafeEqual(cleanCode, expected)) return { valid: true, timeStep };
  }

  return { valid: false, timeStep: null };
}

/**
 * Store TOTP secret for user
 */
export async function enrollTotp(env, projectId, userId) {
  const secret = generateTotpSecret();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Audit F-30: never store the TOTP seed in clear (keyed AES-GCM envelope).
  const stored = await sealSecretAtRest(env, secret);

  await env.DB.prepare(
    `INSERT INTO admin_totp_secrets (id, project_id, user_id, secret, enabled, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       secret = excluded.secret,
       enabled = 0,
       verified_at = NULL,
       created_at = excluded.created_at`
  )
    .bind(id, projectId, userId, stored, now)
    .run();

  return { id, secret };
}

/**
 * Verify and enable TOTP (completes enrollment)
 */
export async function verifyAndEnableTotp(env, projectId, userId, code) {
  const row = await env.DB.prepare(
    `SELECT * FROM admin_totp_secrets WHERE project_id = ? AND user_id = ?`
  )
    .bind(projectId, userId)
    .first();

  if (!row) return { success: false, reason: 'No TOTP enrollment found' };
  if (row.enabled) return { success: false, reason: 'TOTP already enabled' };

  const secret = await openSecretAtRest(env, row.secret);
  if (secret == null) return { success: false, reason: 'TOTP secret unreadable' };
  const valid = await verifyTotp(secret, code);
  if (!valid) return { success: false, reason: 'Invalid code' };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE admin_totp_secrets SET enabled = 1, verified_at = ? WHERE id = ?`
  )
    .bind(now, row.id)
    .run();

  // Generate backup codes
  const { codes, codeHashes } = await generateBackupCodes();
  for (const hash of codeHashes) {
    const codeId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO admin_totp_backup_codes (id, project_id, user_id, code_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(codeId, projectId, userId, hash, now)
      .run();
  }

  return { success: true, backupCodes: codes };
}

/**
 * Check if TOTP is enabled for a user
 */
export async function isTotpEnabled(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT enabled FROM admin_totp_secrets WHERE project_id = ? AND user_id = ? AND enabled = 1`
  )
    .bind(projectId, userId)
    .first();
  return !!row;
}

/**
 * Verify TOTP on admin login
 */
export async function verifyAdminTotp(env, projectId, userId, code) {
  // First try TOTP
  const row = await env.DB.prepare(
    `SELECT * FROM admin_totp_secrets WHERE project_id = ? AND user_id = ? AND enabled = 1`
  )
    .bind(projectId, userId)
    .first();

  if (!row) return { verified: false, reason: 'totp_not_configured' }; // Audit F-29: no silent pass

  // Audit #24: bound online guessing of the TOTP/backup codes per identity.
  const limit = Number(env.RATE_LIMIT_TOTP_VERIFY_PER_MINUTE || 5);
  if (limit > 0) {
    const rate = await checkAndConsumeRateLimit(env, {
      key: `totp-verify:${projectId}:${userId}`,
      limit,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return {
        verified: false,
        rateLimited: true,
        retryAfterSeconds: rate.retryAfterSeconds,
      };
    }
  }

  // Audit fix A2-20: after a key rotation the sealed secret is unreadable —
  // fail closed instead of throwing from the base32 decoder.
  const secret = await openSecretAtRest(env, row.secret);
  if (!secret) return { verified: false, reason: 'secret_unreadable' };

  const valid = await verifyTotpStep(secret, code);
  if (valid.valid) {
    // Audit F-32: single-use codes — claim the matched time step atomically so a
    // captured code cannot be replayed inside its validity window.
    const claim = await env.DB.prepare(
      `UPDATE admin_totp_secrets SET last_used_step = ?
       WHERE id = ? AND (last_used_step IS NULL OR last_used_step < ?)`,
    )
      .bind(valid.timeStep, row.id, valid.timeStep)
      .run();
    if (!Number(claim?.meta?.changes || 0)) {
      return { verified: false, reason: 'code_reused' };
    }
    return { verified: true, method: 'totp' };
  }

  // Try backup code
  const backupResult = await verifyBackupCode(env, projectId, userId, code);
  if (backupResult.verified) return { verified: true, method: 'backup' };

  return { verified: false };
}

/**
 * Verify a backup code
 */
async function verifyBackupCode(env, projectId, userId, code) {
  const cleanCode = code.replace(/[\s-]/g, '').toUpperCase();
  const codeHash = await sha256Hex(cleanCode);

  const row = await env.DB.prepare(
    `SELECT * FROM admin_totp_backup_codes
     WHERE project_id = ? AND user_id = ? AND code_hash = ? AND used_at IS NULL`
  )
    .bind(projectId, userId, codeHash)
    .first();

  if (!row) return { verified: false };

  await env.DB.prepare(
    `UPDATE admin_totp_backup_codes SET used_at = datetime('now') WHERE id = ?`
  )
    .bind(row.id)
    .run();

  return { verified: true };
}

/**
 * Disable TOTP for a user
 */
export async function disableTotp(env, projectId, userId) {
  await env.DB.prepare(
    `DELETE FROM admin_totp_secrets WHERE project_id = ? AND user_id = ?`
  )
    .bind(projectId, userId)
    .run();

  await env.DB.prepare(
    `DELETE FROM admin_totp_backup_codes WHERE project_id = ? AND user_id = ?`
  )
    .bind(projectId, userId)
    .run();

  return true;
}

/**
 * Get 2FA status for a user
 */
export async function getTotpStatus(env, projectId, userId) {
  const secret = await env.DB.prepare(
    `SELECT enabled, verified_at, created_at FROM admin_totp_secrets WHERE project_id = ? AND user_id = ?`
  )
    .bind(projectId, userId)
    .first();

  const backupCount = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM admin_totp_backup_codes
     WHERE project_id = ? AND user_id = ? AND used_at IS NULL`
  )
    .bind(projectId, userId)
    .first();

  return {
    enabled: secret?.enabled === 1,
    verifiedAt: secret?.verified_at || null,
    createdAt: secret?.created_at || null,
    remainingBackupCodes: backupCount?.cnt || 0,
  };
}

// --- Base32 helpers ---

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes) {
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(str) {
  const clean = str.replace(/[^A-Z2-7]/gi, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const val = BASE32_CHARS.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

