/**
 * Passkeys / WebAuthn registration + authentication (D1-backed).
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { decodeClientDataJSON, isoBase64URL } from "@simplewebauthn/server/helpers";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * @param {*} env
 * @param {string | null | undefined} requestOrigin
 */
export function getWebAuthnConfig(env, requestOrigin) {
  const fallbackHost = requestOrigin
    ? new URL(requestOrigin).hostname
    : "localhost";
  const rpID = String(env.WEBAUTHN_RP_ID || fallbackHost).trim();
  const rpName = String(env.WEBAUTHN_RP_NAME || "FluxyChat").trim();
  const originRaw = String(env.WEBAUTHN_ORIGIN || requestOrigin || `https://${rpID}`).trim();
  const origin = originRaw.includes(",")
    ? originRaw.split(",").map((v) => v.trim()).filter(Boolean)
    : originRaw;
  return { rpID, rpName, origin };
}

function userIdToBytes(projectId, userId) {
  return new TextEncoder().encode(`${projectId}:${userId}`);
}

function bytesToBase64url(bytes) {
  return isoBase64URL.fromBuffer(bytes);
}

function base64urlToBytes(encoded) {
  return isoBase64URL.toBuffer(encoded);
}

async function storeChallenge(env, { challenge, projectId, userId, challengeType }) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO webauthn_challenges (challenge, project_id, user_id, challenge_type, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(challenge) DO UPDATE SET expires_at = excluded.expires_at`,
  )
    .bind(challenge, projectId, userId, challengeType, expiresAt)
    .run();
}

async function consumeChallenge(env, challenge, challengeType, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT challenge, project_id, user_id, challenge_type, expires_at
     FROM webauthn_challenges WHERE challenge = ?`,
  )
    .bind(challenge)
    .first();
  if (!row) return { ok: false, reason: "challenge_not_found" };
  if (row.challenge_type !== challengeType) return { ok: false, reason: "challenge_type_mismatch" };
  if (row.project_id !== projectId || row.user_id !== userId) {
    return { ok: false, reason: "challenge_user_mismatch" };
  }
  if (Date.parse(String(row.expires_at)) < Date.now()) {
    await env.DB.prepare(`DELETE FROM webauthn_challenges WHERE challenge = ?`).bind(challenge).run();
    return { ok: false, reason: "challenge_expired" };
  }
  await env.DB.prepare(`DELETE FROM webauthn_challenges WHERE challenge = ?`).bind(challenge).run();
  return { ok: true };
}

export async function purgeExpiredWebAuthnChallenges(env) {
  const now = new Date().toISOString();
  await env.DB.prepare(`DELETE FROM webauthn_challenges WHERE expires_at < ?`).bind(now).run();
}

export async function listWebAuthnCredentials(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT id, credential_id, device_type, backed_up, created_at, last_used_at, transports
     FROM webauthn_credentials
     WHERE project_id = ? AND user_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((row) => ({
    id: Number(row.id),
    credentialId: String(row.credential_id),
    deviceType: row.device_type ? String(row.device_type) : null,
    backedUp: Boolean(row.backed_up),
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    transports: row.transports ? String(row.transports).split(",").filter(Boolean) : [],
  }));
}

export async function deleteWebAuthnCredential(env, projectId, userId, credentialRowId) {
  const result = await env.DB.prepare(
    `DELETE FROM webauthn_credentials
     WHERE id = ? AND project_id = ? AND user_id = ?`,
  )
    .bind(credentialRowId, projectId, userId)
    .run();
  return Number(result.meta?.changes || 0) > 0;
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, userDisplayName?: string, requestOrigin?: string | null }} input
 */
export async function createRegistrationOptions(env, input) {
  const { rpID, rpName, origin } = getWebAuthnConfig(env, input.requestOrigin);
  const existing = await env.DB.prepare(
    `SELECT credential_id, transports FROM webauthn_credentials WHERE project_id = ? AND user_id = ?`,
  )
    .bind(input.projectId, input.userId)
    .all();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: input.userId,
    userDisplayName: input.userDisplayName || input.userId,
    userID: userIdToBytes(input.projectId, input.userId),
    attestationType: "none",
    excludeCredentials: (existing.results || []).map((row) => ({
      id: String(row.credential_id),
      transports: row.transports ? String(row.transports).split(",").filter(Boolean) : [],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge(env, {
    challenge: options.challenge,
    projectId: input.projectId,
    userId: input.userId,
    challengeType: "registration",
  });

  return { options, rpID, origin };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, response: object, requestOrigin?: string | null }} input
 */
export async function verifyRegistration(env, input) {
  const { rpID, origin } = getWebAuthnConfig(env, input.requestOrigin);
  if (!input.response?.response?.clientDataJSON) {
    return { verified: false, reason: "missing_client_data" };
  }
  const clientData = decodeClientDataJSON(input.response.response.clientDataJSON);
  const challengeCheck = await consumeChallenge(
    env,
    clientData.challenge,
    "registration",
    input.projectId,
    input.userId,
  );
  if (!challengeCheck.ok) {
    return { verified: false, reason: challengeCheck.reason };
  }

  const verified = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: clientData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  }).catch(() => null);

  if (!verified?.verified || !verified.registrationInfo) {
    return { verified: false, reason: "registration_verification_failed" };
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verified.registrationInfo;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO webauthn_credentials
     (project_id, user_id, credential_id, public_key, counter, transports, device_type, backed_up, aaguid, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.projectId,
      input.userId,
      credential.id,
      bytesToBase64url(credential.publicKey),
      credential.counter,
      (credential.transports || []).join(","),
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      aaguid || null,
      now,
    )
    .run();

  return { verified: true, credentialId: credential.id };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, requestOrigin?: string | null }} input
 */
export async function createAuthenticationOptions(env, input) {
  const { rpID, origin } = getWebAuthnConfig(env, input.requestOrigin);
  const rows = await env.DB.prepare(
    `SELECT credential_id, transports, public_key, counter
     FROM webauthn_credentials WHERE project_id = ? AND user_id = ?`,
  )
    .bind(input.projectId, input.userId)
    .all();

  if (!(rows.results || []).length) {
    return { error: "no_passkeys_registered", status: 404 };
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: (rows.results || []).map((row) => ({
      id: String(row.credential_id),
      transports: row.transports ? String(row.transports).split(",").filter(Boolean) : [],
    })),
    userVerification: "preferred",
  });

  await storeChallenge(env, {
    challenge: options.challenge,
    projectId: input.projectId,
    userId: input.userId,
    challengeType: "authentication",
  });

  return { options, rpID, origin };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, response: object, requestOrigin?: string | null }} input
 */
export async function verifyAuthentication(env, input) {
  const { rpID, origin } = getWebAuthnConfig(env, input.requestOrigin);
  const credentialId = String(input.response?.id || "");
  if (!credentialId) return { verified: false, reason: "missing_credential_id" };

  const row = await env.DB.prepare(
    `SELECT id, credential_id, public_key, counter, user_id
     FROM webauthn_credentials
     WHERE project_id = ? AND credential_id = ? AND user_id = ?`,
  )
    .bind(input.projectId, credentialId, input.userId)
    .first();

  if (!row) return { verified: false, reason: "credential_not_found" };

  const clientData = decodeClientDataJSON(input.response.response.clientDataJSON);
  const challengeCheck = await consumeChallenge(
    env,
    clientData.challenge,
    "authentication",
    input.projectId,
    input.userId,
  );
  if (!challengeCheck.ok) {
    return { verified: false, reason: challengeCheck.reason };
  }

  const publicKey = base64urlToBytes(String(row.public_key));

  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: clientData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: String(row.credential_id),
      publicKey,
      counter: Number(row.counter) || 0,
      transports: [],
    },
    requireUserVerification: false,
  }).catch(() => null);

  if (!verification?.verified) {
    return { verified: false, reason: "authentication_verification_failed" };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?`,
  )
    .bind(verification.authenticationInfo.newCounter, now, row.id)
    .run();

  return { verified: true, userId: input.userId, projectId: input.projectId };
}
