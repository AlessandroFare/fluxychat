/**

 * CP-005: Per-project push configuration (multi-environment).

 */



import { parseServiceAccountJson } from "./fcm-v1.js";



function generateId() {

  return crypto.randomUUID();

}



function mapConfigRow(row) {

  if (!row) return null;

  const hasLegacyFcm = Boolean(row.fcm_server_key?.trim());

  const hasFcmV1 = Boolean(row.fcm_service_account_json?.trim());

  return {

    id: row.id,

    projectId: row.project_id,

    environment: row.environment,

    hasFcm: hasLegacyFcm || hasFcmV1,

    hasFcmV1,

    hasApns: Boolean(row.apns_key_id && row.apns_team_id && row.apns_private_key_pem),

    webPushEnabled: row.web_push_enabled === 1,

    apnsUseSandbox: row.apns_use_sandbox === 1,

    apnsBundleId: row.apns_bundle_id || null,

    updatedAt: row.updated_at,

  };

}



/**

 * @param {*} env

 * @param {string} projectId

 * @param {string} [environment]

 */

export async function getProjectPushConfig(env, projectId, environment = "production") {

  const row = await env.DB.prepare(

    `SELECT * FROM project_push_config WHERE project_id = ? AND environment = ?`,

  )

    .bind(projectId, environment)

    .first();

  return mapConfigRow(row);

}



export async function listProjectPushConfigs(env, projectId) {

  const rows = await env.DB.prepare(

    `SELECT id, environment, fcm_server_key, fcm_service_account_json, apns_key_id, apns_bundle_id, apns_use_sandbox, web_push_enabled, updated_at

     FROM project_push_config WHERE project_id = ? ORDER BY environment`,

  )

    .bind(projectId)

    .all();

  return (rows.results || []).map((row) => ({

    id: row.id,

    environment: row.environment,

    hasFcm: Boolean(row.fcm_server_key?.trim() || row.fcm_service_account_json?.trim()),

    hasFcmV1: Boolean(row.fcm_service_account_json?.trim()),

    hasApns: Boolean(row.apns_key_id),

    apnsBundleId: row.apns_bundle_id,

    apnsUseSandbox: row.apns_use_sandbox === 1,

    webPushEnabled: row.web_push_enabled === 1,

    updatedAt: row.updated_at,

  }));

}



/**

 * Upsert push config for an environment. Secrets stored encrypted-at-rest by tenant policy (D1).

 */

export async function upsertProjectPushConfig(env, input) {

  const {

    projectId,

    environment = "production",

    fcmServerKey,

    fcmProjectId,

    fcmServiceAccountJson,

    apnsKeyId,

    apnsTeamId,

    apnsBundleId,

    apnsPrivateKeyPem,

    apnsUseSandbox,

    webPushEnabled,

  } = input;



  if (!projectId) return { ok: false, error: "project_id_required" };

  const envName = ["development", "staging", "production"].includes(environment)

    ? environment

    : "production";



  let serviceAccountJson = null;

  if (fcmServiceAccountJson) {

    const raw = typeof fcmServiceAccountJson === "string"

      ? fcmServiceAccountJson

      : JSON.stringify(fcmServiceAccountJson);

    if (!parseServiceAccountJson(raw)) return { ok: false, error: "invalid_fcm_service_account" };

    serviceAccountJson = raw.trim();

  }



  const existing = await env.DB.prepare(

    `SELECT id FROM project_push_config WHERE project_id = ? AND environment = ?`,

  )

    .bind(projectId, envName)

    .first();



  const now = new Date().toISOString();

  const id = existing?.id || generateId();



  await env.DB.prepare(

    `INSERT INTO project_push_config (

       id, project_id, environment, fcm_server_key, fcm_project_id, fcm_service_account_json,

       apns_key_id, apns_team_id, apns_bundle_id, apns_private_key_pem,

       apns_use_sandbox, web_push_enabled, created_at, updated_at

     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

     ON CONFLICT(project_id, environment) DO UPDATE SET

       fcm_server_key = COALESCE(excluded.fcm_server_key, project_push_config.fcm_server_key),

       fcm_project_id = COALESCE(excluded.fcm_project_id, project_push_config.fcm_project_id),

       fcm_service_account_json = COALESCE(excluded.fcm_service_account_json, project_push_config.fcm_service_account_json),

       apns_key_id = COALESCE(excluded.apns_key_id, project_push_config.apns_key_id),

       apns_team_id = COALESCE(excluded.apns_team_id, project_push_config.apns_team_id),

       apns_bundle_id = COALESCE(excluded.apns_bundle_id, project_push_config.apns_bundle_id),

       apns_private_key_pem = COALESCE(excluded.apns_private_key_pem, project_push_config.apns_private_key_pem),

       apns_use_sandbox = excluded.apns_use_sandbox,

       web_push_enabled = excluded.web_push_enabled,

       updated_at = excluded.updated_at`,

  )

    .bind(

      id,

      projectId,

      envName,

      fcmServerKey?.trim() || null,

      fcmProjectId?.trim() || null,

      serviceAccountJson,

      apnsKeyId?.trim() || null,

      apnsTeamId?.trim() || null,

      apnsBundleId?.trim() || null,

      apnsPrivateKeyPem?.trim() || null,

      apnsUseSandbox ? 1 : 0,

      webPushEnabled === false ? 0 : 1,

      now,

      now,

    )

    .run();



  return { ok: true, id, environment: envName };

}



/**

 * Resolve FCM server key: project config for environment, else global env.

 */

export async function resolveFcmServerKey(env, projectId, environment = "production") {

  const row = await env.DB.prepare(

    `SELECT fcm_server_key FROM project_push_config WHERE project_id = ? AND environment = ?`,

  )

    .bind(projectId, environment)

    .first();

  return row?.fcm_server_key?.trim() || env.FCM_SERVER_KEY?.trim() || null;

}



/**

 * Resolve FCM HTTP v1 service account JSON (project config or global env).

 */

export async function resolveFcmServiceAccount(env, projectId, environment = "production") {

  try {

    const row = await env.DB.prepare(

      `SELECT fcm_service_account_json FROM project_push_config WHERE project_id = ? AND environment = ?`,

    )

      .bind(projectId, environment)

      .first();

    const fromDb = parseServiceAccountJson(row?.fcm_service_account_json);

    if (fromDb) return fromDb;

  } catch {

    // column may not exist before migration 0201

  }

  return parseServiceAccountJson(env.FCM_SERVICE_ACCOUNT_JSON?.trim() || null);

}


