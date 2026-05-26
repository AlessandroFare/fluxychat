/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function parseMemberPreferencesJson(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} body
 * @returns {{ notifyEnabled?: boolean, preferences?: Record<string, unknown> } | null}
 */
export function normalizeMemberPreferencesPatch(body) {
  if (!body || typeof body !== "object") return null;
  const out = {};
  if (typeof body.notifyEnabled === "boolean") {
    out.notifyEnabled = body.notifyEnabled;
  }
  if (body.preferences != null) {
    if (typeof body.preferences !== "object" || Array.isArray(body.preferences)) {
      return null;
    }
    out.preferences = body.preferences;
  }
  if (!Object.keys(out).length) return null;
  return out;
}

export function mapMemberRow(row) {
  if (!row) return null;
  const preferences = parseMemberPreferencesJson(row.preferences_json);
  return {
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    notifyEnabled: row.notify_enabled !== 0,
    preferences: preferences ?? {},
  };
}
