/**
 * Data residency enforcement at write path (roadmap #14).
 */

export const VALID_REGIONS = [
  "us-east",
  "us-west",
  "eu-west",
  "eu-central",
  "ap-southeast",
  "ap-northeast",
  "sa-east",
  "me-central",
];

const REGION_ALIASES = {
  WEUR: "eu-west",
  EEUR: "eu-central",
  ENAM: "us-east",
  WNAM: "us-west",
  APAC: "ap-southeast",
};

export function normalizeRegionCode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (REGION_ALIASES[upper]) return REGION_ALIASES[upper];
  if (VALID_REGIONS.includes(value)) return value;
  return null;
}

export function resolveWorkerRegion(env) {
  const fromEnv = normalizeRegionCode(env?.DATA_REGION ?? env?.WORKER_DATA_REGION);
  if (fromEnv) return fromEnv;
  return "eu-west";
}

function parseRegionsJson(raw) {
  if (!raw) return ["eu-west"];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((r) => normalizeRegionCode(r)).filter(Boolean)
      : ["eu-west"];
  } catch {
    return ["eu-west"];
  }
}

export async function getProjectResidencySettings(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT primary_region, allowed_regions_json, inference_region, enforce_writes, updated_at
     FROM project_data_residency WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();

  if (!row) {
    return {
      primaryRegion: resolveWorkerRegion(env),
      allowedRegions: [resolveWorkerRegion(env)],
      inferenceRegion: resolveWorkerRegion(env),
      enforceWrites: env.DATA_RESIDENCY_ENFORCE === "true",
      updatedAt: null,
      configured: false,
    };
  }

  return {
    primaryRegion: normalizeRegionCode(row.primary_region) ?? "eu-west",
    allowedRegions: parseRegionsJson(row.allowed_regions_json),
    inferenceRegion: normalizeRegionCode(row.inference_region) ?? normalizeRegionCode(row.primary_region) ?? "eu-west",
    enforceWrites: row.enforce_writes === 1,
    updatedAt: row.updated_at,
    configured: true,
  };
}

export async function upsertProjectResidencySettings(env, projectId, input) {
  const primaryRegion = normalizeRegionCode(input.primaryRegion);
  if (!primaryRegion) return { ok: false, error: "invalid_primary_region" };

  const allowedRegions = Array.isArray(input.allowedRegions)
    ? [...new Set(input.allowedRegions.map((r) => normalizeRegionCode(r)).filter(Boolean))]
    : [primaryRegion];

  if (!allowedRegions.includes(primaryRegion)) {
    allowedRegions.unshift(primaryRegion);
  }

  const inferenceRegion = normalizeRegionCode(input.inferenceRegion) ?? primaryRegion;
  if (!allowedRegions.includes(inferenceRegion)) {
    return { ok: false, error: "inference_region_not_allowed" };
  }

  const enforceWrites = input.enforceWrites === false ? 0 : 1;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO project_data_residency (project_id, primary_region, allowed_regions_json, inference_region, enforce_writes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       primary_region = excluded.primary_region,
       allowed_regions_json = excluded.allowed_regions_json,
       inference_region = excluded.inference_region,
       enforce_writes = excluded.enforce_writes,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, primaryRegion, JSON.stringify(allowedRegions), inferenceRegion, enforceWrites, now)
    .run();

  return {
    ok: true,
    settings: await getProjectResidencySettings(env, projectId),
  };
}

/**
 * Block writes when worker region is outside tenant allowed regions.
 */
export async function assertProjectWriteResidency(env, projectId, { operation = "write" } = {}) {
  if (env.DATA_RESIDENCY_ENFORCE === "false") {
    return { ok: true, skipped: true };
  }

  const settings = await getProjectResidencySettings(env, projectId);
  if (!settings.enforceWrites && !settings.configured) {
    return { ok: true, skipped: true };
  }

  const workerRegion = resolveWorkerRegion(env);
  if (!settings.allowedRegions.includes(workerRegion)) {
    return {
      ok: false,
      error: "data_residency_violation",
      operation,
      workerRegion,
      allowedRegions: settings.allowedRegions,
      primaryRegion: settings.primaryRegion,
    };
  }

  return { ok: true, workerRegion, primaryRegion: settings.primaryRegion };
}

export function resolveInferenceRegionForProject(settings, preferred = []) {
  const prefs = preferred.map((r) => normalizeRegionCode(r)).filter(Boolean);
  for (const region of prefs) {
    if (settings.allowedRegions.includes(region)) return region;
  }
  return settings.inferenceRegion ?? settings.primaryRegion;
}
