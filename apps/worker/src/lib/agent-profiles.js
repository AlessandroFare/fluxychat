/**
 * P17-F: Custom Agent Behavior Profiles
 * Configurable tone, verbosity, policy constraints, and A/B testing.
 */

const PROFILE_ROLES = ["owner", "admin"];
const VALID_TONES = ["professional", "friendly", "formal", "casual", "empathetic", "technical"];
const VALID_VERBOSITY = ["concise", "balanced", "detailed"];
const VALID_FOLLOW_UP = ["proactive", "reactive", "minimal"];
const VALID_ESCALATION = ["low", "medium", "high", "never"];
const NAME_MAX = 64;
const DESC_MAX = 256;
const PROMPT_MAX = 2048;

function generateId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function clampWeight(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, Math.floor(n)));
}

function sanitizeName(v) {
  return String(v || "").trim().slice(0, NAME_MAX);
}

function sanitizeDesc(v) {
  return String(v || "").trim().slice(0, DESC_MAX);
}

function sanitizePrompt(v) {
  return String(v || "").trim().slice(0, PROMPT_MAX);
}

function mapProfileRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    description: row.description || null,
    tone: row.tone, verbosity: row.verbosity,
    followUpStyle: row.follow_up_style,
    escalationThreshold: row.escalation_threshold,
    policyConstraints: (() => { try { return JSON.parse(row.policy_constraints || "{}"); } catch { return {}; } })(),
    businessObjectives: (() => { try { return JSON.parse(row.business_objectives || "{}"); } catch { return {}; } })(),
    systemPromptAddendum: row.system_prompt_addendum || null,
    abTestWeight: row.ab_test_weight,
    enabled: row.enabled === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAssignmentRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    profileId: row.profile_id, assignedBy: row.assigned_by,
    abTestGroup: row.ab_test_group || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/* ── access control ── */

export function canManageProfiles(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => PROFILE_ROLES.includes(r));
}

/* ── CRUD ── */

export async function listProfiles(db, { projectId }) {
  const rows = await db.prepare(
    `SELECT * FROM agent_profiles WHERE project_id = ? ORDER BY name`
  ).bind(projectId).all();
  return (rows.results || []).map(mapProfileRow);
}

export async function getProfile(db, { projectId, profileId }) {
  const row = await db.prepare(
    `SELECT * FROM agent_profiles WHERE id = ? AND project_id = ?`
  ).bind(profileId, projectId).first();
  return row ? mapProfileRow(row) : null;
}

export async function createProfile(db, { projectId, name, description, tone, verbosity, followUpStyle, escalationThreshold, policyConstraints, businessObjectives, systemPromptAddendum, abTestWeight }) {
  const trimmed = sanitizeName(name);
  if (!trimmed) return { ok: false, error: "name_required" };
  if (trimmed.length > NAME_MAX) return { ok: false, error: "name_too_long" };

  const existing = await db.prepare(
    `SELECT id FROM agent_profiles WHERE project_id = ? AND name = ?`
  ).bind(projectId, trimmed).first();
  if (existing) return { ok: false, error: "name_taken" };

  const id = generateId();
  const now = nowIso();
  const t = VALID_TONES.includes(tone) ? tone : "professional";
  const v = VALID_VERBOSITY.includes(verbosity) ? verbosity : "balanced";
  const f = VALID_FOLLOW_UP.includes(followUpStyle) ? followUpStyle : "proactive";
  const e = VALID_ESCALATION.includes(escalationThreshold) ? escalationThreshold : "medium";

  await db.prepare(
    `INSERT INTO agent_profiles (id, project_id, name, description, tone, verbosity, follow_up_style, escalation_threshold, policy_constraints, business_objectives, system_prompt_addendum, ab_test_weight, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    id, projectId, trimmed, sanitizeDesc(description),
    t, v, f, e,
    JSON.stringify(policyConstraints || {}),
    JSON.stringify(businessObjectives || {}),
    sanitizePrompt(systemPromptAddendum),
    clampWeight(abTestWeight), now, now
  ).run();

  return { ok: true, id };
}

export async function updateProfile(db, { projectId, profileId, name, description, tone, verbosity, followUpStyle, escalationThreshold, policyConstraints, businessObjectives, systemPromptAddendum, abTestWeight, enabled }) {
  const existing = await db.prepare(
    `SELECT id FROM agent_profiles WHERE id = ? AND project_id = ?`
  ).bind(profileId, projectId).first();
  if (!existing) return { ok: false, error: "not_found" };

  if (name !== undefined) {
    const trimmed = sanitizeName(name);
    if (!trimmed) return { ok: false, error: "name_required" };
    const dup = await db.prepare(
      `SELECT id FROM agent_profiles WHERE project_id = ? AND name = ? AND id != ?`
    ).bind(projectId, trimmed, profileId).first();
    if (dup) return { ok: false, error: "name_taken" };
  }

  const now = nowIso();
  const sets = [];
  const params = [];

  if (name !== undefined) { sets.push("name = ?"); params.push(sanitizeName(name)); }
  if (description !== undefined) { sets.push("description = ?"); params.push(sanitizeDesc(description)); }
  if (tone !== undefined && VALID_TONES.includes(tone)) { sets.push("tone = ?"); params.push(tone); }
  if (verbosity !== undefined && VALID_VERBOSITY.includes(verbosity)) { sets.push("verbosity = ?"); params.push(verbosity); }
  if (followUpStyle !== undefined && VALID_FOLLOW_UP.includes(followUpStyle)) { sets.push("follow_up_style = ?"); params.push(followUpStyle); }
  if (escalationThreshold !== undefined && VALID_ESCALATION.includes(escalationThreshold)) { sets.push("escalation_threshold = ?"); params.push(escalationThreshold); }
  if (policyConstraints !== undefined) { sets.push("policy_constraints = ?"); params.push(JSON.stringify(policyConstraints)); }
  if (businessObjectives !== undefined) { sets.push("business_objectives = ?"); params.push(JSON.stringify(businessObjectives)); }
  if (systemPromptAddendum !== undefined) { sets.push("system_prompt_addendum = ?"); params.push(sanitizePrompt(systemPromptAddendum)); }
  if (abTestWeight !== undefined) { sets.push("ab_test_weight = ?"); params.push(clampWeight(abTestWeight)); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  if (sets.length === 0) return { ok: true };

  sets.push("updated_at = ?");
  params.push(now);
  params.push(profileId);
  params.push(projectId);

  await db.prepare(
    `UPDATE agent_profiles SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  ).bind(...params).run();

  return { ok: true };
}

export async function deleteProfile(db, { projectId, profileId }) {
  await db.prepare(
    `DELETE FROM room_profile_assignments WHERE profile_id = ? AND project_id = ?`
  ).bind(profileId, projectId).run();

  const result = await db.prepare(
    `DELETE FROM agent_profiles WHERE id = ? AND project_id = ?`
  ).bind(profileId, projectId).run();
  return { ok: true, deleted: (result.meta?.changes || 0) > 0 };
}

/* ── prompt building ── */

export function buildProfilePrompt(profile) {
  if (!profile) return null;

  const parts = [];

  parts.push(`Tone: ${profile.tone}.`);
  parts.push(`Verbosity: ${profile.verbosity}.`);
  parts.push(`Follow-up style: ${profile.followUpStyle}.`);

  if (profile.escalationThreshold !== "never") {
    parts.push(`Escalate to human when: ${profile.escalationThreshold} severity issues.`);
  } else {
    parts.push("Do not escalate; handle all issues yourself.");
  }

  const pc = profile.policyConstraints || {};
  if (pc.max_response_length) parts.push(`Keep responses under ${pc.max_response_length} characters.`);
  if (Array.isArray(pc.allowed_topics) && pc.allowed_topics.length > 0) {
    parts.push(`Focus on these topics: ${pc.allowed_topics.join(", ")}.`);
  }
  if (Array.isArray(pc.blocked_topics) && pc.blocked_topics.length > 0) {
    parts.push(`Avoid discussing: ${pc.blocked_topics.join(", ")}.`);
  }
  if (Array.isArray(pc.require_human_for) && pc.require_human_for.length > 0) {
    parts.push(`Transfer to human for: ${pc.require_human_for.join(", ")}.`);
  }

  const bo = profile.businessObjectives || {};
  if (bo.priority) parts.push(`Business priority: ${bo.priority}.`);
  if (bo.kpi_targets && typeof bo.kpi_targets === "object") {
    const kpis = Object.entries(bo.kpi_targets).map(([k, v]) => `${k}=${v}`).join(", ");
    if (kpis) parts.push(`KPI targets: ${kpis}.`);
  }

  if (profile.systemPromptAddendum) {
    parts.push(`\nAdditional instructions:\n${profile.systemPromptAddendum}`);
  }

  return parts.join(" ");
}

/* ── room assignment ── */

export async function assignProfileToRoom(db, { projectId, roomId, profileId, assignedBy = "manual", abTestGroup }) {
  const profile = await db.prepare(
    `SELECT id FROM agent_profiles WHERE id = ? AND project_id = ? AND enabled = 1`
  ).bind(profileId, projectId).first();
  if (!profile) return { ok: false, error: "profile_not_found" };

  const id = generateId();
  const now = nowIso();

  await db.prepare(
    `INSERT INTO room_profile_assignments (id, project_id, room_id, profile_id, assigned_by, ab_test_group, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       profile_id = excluded.profile_id, assigned_by = excluded.assigned_by,
       ab_test_group = excluded.ab_test_group, updated_at = excluded.updated_at`
  ).bind(id, projectId, roomId, profileId, assignedBy, abTestGroup || null, now, now).run();

  return { ok: true, id };
}

export async function getRoomAssignment(db, { projectId, roomId }) {
  const row = await db.prepare(
    `SELECT * FROM room_profile_assignments WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).first();
  return row ? mapAssignmentRow(row) : null;
}

export async function getProfileForRoom(db, { projectId, roomId }) {
  const assignment = await getRoomAssignment(db, { projectId, roomId });
  if (!assignment) return null;
  return getProfile(db, { projectId, profileId: assignment.profileId });
}

export async function removeRoomAssignment(db, { projectId, roomId }) {
  const result = await db.prepare(
    `DELETE FROM room_profile_assignments WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).run();
  return { ok: true, removed: (result.meta?.changes || 0) > 0 };
}

/* ── A/B testing ── */

export async function abTestAssign(db, { projectId, roomId, profileIds }) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return { ok: false, error: "profileIds_required" };
  }

  const profiles = [];
  for (const pid of profileIds) {
    const p = await db.prepare(
      `SELECT id, ab_test_weight FROM agent_profiles WHERE id = ? AND project_id = ? AND enabled = 1`
    ).bind(pid, projectId).first();
    if (p) profiles.push(p);
  }

  if (profiles.length === 0) return { ok: false, error: "no_valid_profiles" };

  const totalWeight = profiles.reduce((s, p) => s + p.ab_test_weight, 0);
  if (totalWeight <= 0) return { ok: false, error: "total_weight_zero" };

  let rand = Math.random() * totalWeight;
  let chosen = profiles[0];
  for (const p of profiles) {
    rand -= p.ab_test_weight;
    if (rand <= 0) { chosen = p; break; }
  }

  const groupLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const groupIdx = profiles.findIndex((p) => p.id === chosen.id);
  const group = groupLabels[groupIdx] || "A";

  const result = await assignProfileToRoom(db, { projectId, roomId, profileId: chosen.id, assignedBy: "ab_test", abTestGroup: group });
  return { ...result, profileId: chosen.id, group };
}

export async function getAbTestResults(db, { projectId, profileIds }) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return { ok: false, error: "profileIds_required" };
  }

  const results = [];
  const groupLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let i = 0; i < profileIds.length; i++) {
    const pid = profileIds[i];
    const profile = await db.prepare(
      `SELECT * FROM agent_profiles WHERE id = ? AND project_id = ?`
    ).bind(pid, projectId).first();
    if (!profile) continue;

    const assignmentCount = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM room_profile_assignments WHERE profile_id = ? AND project_id = ?`
    ).bind(pid, projectId).first();

    const abTestCount = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM room_profile_assignments WHERE profile_id = ? AND project_id = ? AND assigned_by = 'ab_test'`
    ).bind(pid, projectId).first();

    results.push({
      profileId: pid,
      profileName: profile.name,
      group: groupLabels[i] || "?",
      totalAssignments: assignmentCount?.cnt || 0,
      abTestAssignments: abTestCount?.cnt || 0,
      weight: profile.ab_test_weight,
    });
  }

  return { ok: true, results };
}
