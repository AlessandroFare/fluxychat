/**
 * Sent.dm contact sync + opt-out mirror (P10-S5).
 */

const E164_RE = /^\+[1-9]\d{6,14}$/;

function sentHeaders(env) {
  const apiKey = env.SENT_DM_API_KEY?.trim();
  const profileId = env.SENT_DM_PROFILE_ID?.trim();
  if (!apiKey || !profileId) return null;
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "x-profile-id": profileId,
  };
}

/**
 * @param {*} env
 * @param {string} e164
 */
export async function fetchSentContactByPhone(env, e164) {
  const headers = sentHeaders(env);
  if (!headers) return { ok: false, error: "sent_not_configured" };

  const url = new URL("https://api.sent.dm/v3/contacts");
  url.searchParams.set("phone", e164);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `sent_${res.status}`, detail: text.slice(0, 200) };
  }
  const json = await res.json().catch(() => ({}));
  const contacts =
    json?.data?.contacts ??
    (Array.isArray(json?.data) ? json.data : null) ??
    (json?.data?.id ? [json.data] : []);
  const first = Array.isArray(contacts) ? contacts[0] : json?.data;
  if (!first?.id && !first?.format_e164) {
    return { ok: true, contact: null };
  }
  return {
    ok: true,
    contact: {
      id: first.id,
      e164: first.format_e164 || first.phone_number || e164,
      optOut: Boolean(first.opt_out),
      defaultChannel: first.default_channel || null,
    },
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId?: string,
 *   e164: string,
 *   sentContactId?: string,
 *   optOut?: boolean,
 *   defaultChannel?: string,
 * }} row
 */
export async function upsertSentDmContactMirror(env, row) {
  if (!env?.DB) return null;
  const e164 = row.e164?.trim();
  if (!E164_RE.test(e164)) return null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const optOut = row.optOut ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO sent_dm_contacts
     (id, project_id, user_id, e164, sent_contact_id, opt_out, default_channel, synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, e164) DO UPDATE SET
       user_id = COALESCE(excluded.user_id, sent_dm_contacts.user_id),
       sent_contact_id = COALESCE(excluded.sent_contact_id, sent_dm_contacts.sent_contact_id),
       opt_out = excluded.opt_out,
       default_channel = COALESCE(excluded.default_channel, sent_dm_contacts.default_channel),
       synced_at = excluded.synced_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      row.projectId,
      row.userId ?? null,
      e164,
      row.sentContactId ?? null,
      optOut,
      row.defaultChannel ?? null,
      now,
      now,
      now,
    )
    .run();
  return { e164, optOut: Boolean(optOut) };
}

/**
 * Mirror Sent opt-out into room_members.preferences.smsOptIn when user_id is known.
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 * @param {boolean} optOut
 */
export async function mirrorSmsOptOutToMemberPreferences(env, projectId, userId, optOut) {
  if (!env?.DB || !userId) return;
  const rows = await env.DB.prepare(
    `SELECT room_id, preferences FROM room_members
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .all();
  const now = new Date().toISOString();
  for (const row of rows.results || []) {
    let prefs = {};
    try {
      prefs =
        typeof row.preferences === "string"
          ? JSON.parse(row.preferences)
          : row.preferences || {};
    } catch {
      prefs = {};
    }
    if (optOut) {
      prefs.smsOptIn = false;
      prefs.sms_opt_in = false;
    }
    await env.DB.prepare(
      "UPDATE room_members SET preferences = ?, updated_at = ? WHERE project_id = ? AND room_id = ? AND user_id = ?",
    )
      .bind(JSON.stringify(prefs), now, projectId, row.room_id, userId)
      .run();
  }
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId?: string, e164: string }} opts
 */
export async function syncSentContactForE164(env, opts) {
  const e164 = opts.e164?.trim();
  if (!E164_RE.test(e164)) {
    return { ok: false, error: "invalid_e164" };
  }
  const remote = await fetchSentContactByPhone(env, e164);
  if (!remote.ok) return remote;

  const contact = remote.contact;
  const mirror = await upsertSentDmContactMirror(env, {
    projectId: opts.projectId,
    userId: opts.userId,
    e164,
    sentContactId: contact?.id ?? null,
    optOut: contact?.optOut ?? false,
    defaultChannel: contact?.defaultChannel ?? null,
  });

  if (opts.userId && contact?.optOut) {
    await mirrorSmsOptOutToMemberPreferences(env, opts.projectId, opts.userId, true);
  }

  return { ok: true, contact, mirror };
}

/**
 * @param {*} env
 * @param {unknown} body
 */
export async function handleSentContactWebhookEvent(env, body) {
  if (!body || typeof body !== "object") return { ok: true, ignored: true };
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const type = String(body.type || data.event || "").toLowerCase();
  const e164 =
    (typeof data.format_e164 === "string" && data.format_e164) ||
    (typeof data.phone_number === "string" && data.phone_number) ||
    (typeof data.to === "string" && data.to) ||
    null;
  const optOut =
    type.includes("opt") && type.includes("out") ||
    data.opt_out === true ||
    data.optOut === true;

  if (!e164 || !optOut) return { ok: true, ignored: true };

  const rows = await env.DB.prepare(
    "SELECT project_id, user_id FROM sent_dm_contacts WHERE e164 = ?",
  )
    .bind(e164)
    .all();

  for (const row of rows.results || []) {
    await upsertSentDmContactMirror(env, {
      projectId: row.project_id,
      userId: row.user_id ?? undefined,
      e164,
      optOut: true,
    });
    if (row.user_id) {
      await mirrorSmsOptOutToMemberPreferences(env, row.project_id, row.user_id, true);
    }
  }

  return { ok: true, e164, optOut: true, updated: (rows.results || []).length };
}
