const MAX_JSON = 4000;

/**
 * @param {unknown} raw
 */
export function parseAsymmetryProfile(raw) {
  if (raw == null || raw === "") {
    return { ok: true, profile: { name: "default", roles: {} } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "profile_must_be_object" };
  }
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 64)
      : "custom";
  const rolesIn = raw.roles && typeof raw.roles === "object" ? raw.roles : {};
  /** @type {Record<string, { privateHints: boolean, aiNotes: boolean, panel: string }>} */
  const roles = {};
  for (const [role, cfg] of Object.entries(rolesIn)) {
    const key = String(role).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    if (!key) continue;
    const c = cfg && typeof cfg === "object" ? cfg : {};
    roles[key] = {
      privateHints: c.privateHints === true,
      aiNotes: c.aiNotes === true,
      panel: typeof c.panel === "string" ? c.panel.trim().slice(0, 64) : "default",
    };
  }
  return { ok: true, profile: { name, roles } };
}

function mapRow(row) {
  if (!row) return null;
  let profile = { name: "default", roles: {} };
  try {
    const parsed = parseAsymmetryProfile(JSON.parse(row.asymmetry_profile_json || "{}"));
    if (parsed.ok) profile = parsed.profile;
  } catch {
    /* keep default */
  }
  return {
    roomId: row.room_id,
    projectId: row.project_id,
    profile,
    updatedAt: row.updated_at,
  };
}

export async function getRoomSessionProfile(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_session_profiles WHERE project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();
  return mapRow(row) ?? {
    roomId,
    projectId,
    profile: { name: "default", roles: {} },
    updatedAt: null,
  };
}

export async function putRoomSessionProfile(env, { projectId, roomId, profile }) {
  const parsed = parseAsymmetryProfile(profile);
  if (!parsed.ok) return parsed;
  const json = JSON.stringify(parsed.profile);
  if (json.length > MAX_JSON) return { ok: false, error: "profile_too_large" };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_session_profiles (room_id, project_id, asymmetry_profile_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       project_id = excluded.project_id,
       asymmetry_profile_json = excluded.asymmetry_profile_json,
       updated_at = excluded.updated_at`,
  )
    .bind(roomId, projectId, json, now)
    .run();
  return { ok: true, roomId, projectId, profile: parsed.profile, updatedAt: now };
}
