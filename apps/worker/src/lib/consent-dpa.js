/**
 * EU consent banner + DPA audit log (roadmap #42).
 * Pairs with data residency (#14).
 */

import { getProjectResidencySettings, normalizeRegionCode } from "./data-residency-settings.js";

const EU_REGION_PREFIX = "eu-";
const VALID_EVENT_TYPES = new Set(["accepted", "declined", "withdrawn"]);

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function isEuRegion(region) {
  const normalized = normalizeRegionCode(region);
  return Boolean(normalized?.startsWith(EU_REGION_PREFIX));
}

export async function hashConsentClientHint(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function mapSettingsRow(row) {
  if (!row) {
    return {
      enabled: false,
      autoEuOnly: true,
      dpaVersion: "1.0",
      bannerTitle: "Data processing consent",
      bannerBody:
        "This workspace processes chat data under our Data Processing Agreement. Accept to continue in EU-regulated rooms.",
      dpaDocumentUrl: null,
      requireRoomConsent: false,
      updatedAt: null,
      configured: false,
    };
  }
  return {
    enabled: row.enabled === 1,
    autoEuOnly: row.auto_eu_only !== 0,
    dpaVersion: row.dpa_version || "1.0",
    bannerTitle: row.banner_title || "Data processing consent",
    bannerBody:
      row.banner_body ||
      "This workspace processes chat data under our Data Processing Agreement. Accept to continue in EU-regulated rooms.",
    dpaDocumentUrl: row.dpa_document_url ?? null,
    requireRoomConsent: row.require_room_consent === 1,
    updatedAt: row.updated_at,
    configured: true,
  };
}

export async function getProjectConsentSettings(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT enabled, auto_eu_only, dpa_version, banner_title, banner_body, dpa_document_url,
            require_room_consent, updated_at
     FROM project_consent_settings WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();
  return mapSettingsRow(row);
}

export async function upsertProjectConsentSettings(env, projectId, input) {
  const dpaVersion = String(input.dpaVersion ?? "1.0").trim() || "1.0";
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO project_consent_settings
       (project_id, enabled, auto_eu_only, dpa_version, banner_title, banner_body,
        dpa_document_url, require_room_consent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       enabled = excluded.enabled,
       auto_eu_only = excluded.auto_eu_only,
       dpa_version = excluded.dpa_version,
       banner_title = excluded.banner_title,
       banner_body = excluded.banner_body,
       dpa_document_url = excluded.dpa_document_url,
       require_room_consent = excluded.require_room_consent,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      input.enabled === true ? 1 : 0,
      input.autoEuOnly === false ? 0 : 1,
      dpaVersion,
      input.bannerTitle?.trim() || null,
      input.bannerBody?.trim() || null,
      input.dpaDocumentUrl?.trim() || null,
      input.requireRoomConsent === true ? 1 : 0,
      now,
    )
    .run();

  return { ok: true, settings: await getProjectConsentSettings(env, projectId) };
}

export async function projectRequiresConsentBanner(env, projectId) {
  const settings = await getProjectConsentSettings(env, projectId);
  if (!settings.enabled) return { required: false, settings, reason: "disabled" };

  if (!settings.autoEuOnly) {
    return { required: true, settings, reason: "manual_enabled" };
  }

  const residency = await getProjectResidencySettings(env, projectId);
  const euPrimary = isEuRegion(residency.primaryRegion);
  const euInference = isEuRegion(residency.inferenceRegion);
  const euAllowed = residency.allowedRegions.some((r) => isEuRegion(r));

  if (euPrimary || euInference || euAllowed) {
    return { required: true, settings, reason: "eu_residency", residency };
  }

  return { required: false, settings, reason: "non_eu_residency", residency };
}

export async function getLatestConsentEvent(env, { projectId, userId, roomId, requireRoomConsent }) {
  const sql =
    requireRoomConsent && roomId
      ? `SELECT * FROM consent_events
         WHERE project_id = ? AND user_id = ? AND room_id = ?
         ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM consent_events
         WHERE project_id = ? AND user_id = ?
         ORDER BY created_at DESC LIMIT 1`;
  const binds =
    requireRoomConsent && roomId ? [projectId, userId, roomId] : [projectId, userId];

  const row = await env.DB.prepare(sql).bind(...binds).first();
  if (!row) return null;

  return {
    id: row.id,
    eventType: row.event_type,
    dpaVersion: row.dpa_version,
    roomId: row.room_id,
    createdAt: row.created_at,
  };
}

export async function getConsentStatusForUser(env, { projectId, userId, roomId }) {
  const policy = await projectRequiresConsentBanner(env, projectId);
  if (!policy.required) {
    return {
      ok: true,
      needsBanner: false,
      reason: policy.reason,
      settings: policy.settings,
    };
  }

  const settings = policy.settings;
  const latest = await getLatestConsentEvent(env, {
    projectId,
    userId,
    roomId,
    requireRoomConsent: settings.requireRoomConsent,
  });

  const accepted =
    latest?.eventType === "accepted" && latest.dpaVersion === settings.dpaVersion;

  return {
    ok: true,
    needsBanner: !accepted,
    reason: accepted ? "already_accepted" : "consent_required",
    settings: {
      dpaVersion: settings.dpaVersion,
      bannerTitle: settings.bannerTitle,
      bannerBody: settings.bannerBody,
      dpaDocumentUrl: settings.dpaDocumentUrl,
      requireRoomConsent: settings.requireRoomConsent,
    },
    latestEvent: latest,
    policyReason: policy.reason,
  };
}

export async function recordConsentEvent(env, input) {
  const eventType = String(input.eventType || "").trim().toLowerCase();
  if (!VALID_EVENT_TYPES.has(eventType)) {
    return { ok: false, error: "invalid_event_type" };
  }
  if (!input.projectId || !input.userId) {
    return { ok: false, error: "missing_fields" };
  }

  const settings = await getProjectConsentSettings(env, input.projectId);
  const dpaVersion = String(input.dpaVersion ?? settings.dpaVersion ?? "1.0").trim() || "1.0";
  const id = generateId("cev");
  const now = new Date().toISOString();
  const ipHash = input.clientIp ? await hashConsentClientHint(input.clientIp) : null;
  const userAgent = input.userAgent ? String(input.userAgent).slice(0, 512) : null;
  const metadata =
    input.metadata && typeof input.metadata === "object"
      ? JSON.stringify(input.metadata)
      : null;

  await env.DB.prepare(
    `INSERT INTO consent_events
       (id, project_id, user_id, room_id, event_type, dpa_version, ip_hash, user_agent, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.userId,
      input.roomId?.trim() || null,
      eventType,
      dpaVersion,
      ipHash,
      userAgent,
      metadata,
      now,
    )
    .run();

  return {
    ok: true,
    event: {
      id,
      eventType,
      dpaVersion,
      roomId: input.roomId?.trim() || null,
      createdAt: now,
    },
  };
}

export async function listConsentEvents(env, { projectId, limit = 50, roomId, userId }) {
  let sql = `SELECT id, project_id, user_id, room_id, event_type, dpa_version, ip_hash, user_agent, created_at
             FROM consent_events WHERE project_id = ?`;
  const binds = [projectId];

  if (roomId) {
    sql += ` AND room_id = ?`;
    binds.push(roomId);
  }
  if (userId) {
    sql += ` AND user_id = ?`;
    binds.push(userId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(Math.min(Number(limit) || 50, 200));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    eventType: row.event_type,
    dpaVersion: row.dpa_version,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}
