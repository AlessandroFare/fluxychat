/**
 * Per-room auto-translate settings (roadmap #4).
 */

import { normalizeTargetLang } from "./message-translation.js";

export async function getRoomTranslationSettings(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT enabled, auto_translate_target, updated_at
     FROM room_translation_settings WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();

  if (!row) {
    return {
      enabled: false,
      autoTranslateTarget: null,
      updatedAt: null,
    };
  }

  return {
    enabled: row.enabled === 1,
    autoTranslateTarget: row.auto_translate_target ?? null,
    updatedAt: row.updated_at,
  };
}

export async function upsertRoomTranslationSettings(env, projectId, roomId, input) {
  const enabled = input.enabled === true || input.enabled === 1 || input.enabled === "true";
  const targetRaw = input.autoTranslateTarget ?? input.auto_translate_target ?? null;
  const autoTranslateTarget = targetRaw ? normalizeTargetLang(String(targetRaw)) : null;

  if (enabled && !autoTranslateTarget) {
    return { ok: false, error: "auto_translate_target_required" };
  }
  if (targetRaw && !autoTranslateTarget) {
    return { ok: false, error: "invalid_target_lang" };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_translation_settings (project_id, room_id, enabled, auto_translate_target, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       enabled = excluded.enabled,
       auto_translate_target = excluded.auto_translate_target,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, roomId, enabled ? 1 : 0, autoTranslateTarget, now)
    .run();

  return {
    ok: true,
    settings: await getRoomTranslationSettings(env, projectId, roomId),
  };
}

export async function listRoomsWithTranslationSettings(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT room_id, enabled, auto_translate_target, updated_at
     FROM room_translation_settings WHERE project_id = ?
     ORDER BY updated_at DESC LIMIT 200`,
  )
    .bind(projectId)
    .all();

  return (rows.results || []).map((row) => ({
    roomId: row.room_id,
    enabled: row.enabled === 1,
    autoTranslateTarget: row.auto_translate_target ?? null,
    updatedAt: row.updated_at,
  }));
}
