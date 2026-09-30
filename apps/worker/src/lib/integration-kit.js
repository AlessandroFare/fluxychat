/**
 * Entity rooms + inbound webhooks + write intents.
 * Workspace OAuth apps are not in this module.
 */
import { encryptSecret, decryptSecret } from "./secrets-crypto.js";
import { verifyWebhookSignature } from "./webhook-batch-verify.js";
import { isWebhookSecretEncryptionRequired, isPlaintextWebhookSecretAllowed } from "./webhook-signing.js";
import { fanoutRoomInternal } from "./room-shard.js";
import { logInfo } from "./worker-log.js";
import { createExternalTicket } from "./room-tickets.js";
import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { hostedSharedWorkerPatForbidden } from "./hosted-saas-policy.js";
import {
  INTEGRATION_PROVIDERS,
  integrationCatalog,
  mapProviderPayload,
  parseEntityRef,
  writesViaEnvPat,
} from "./integration-providers.js";

export { INTEGRATION_PROVIDERS, integrationCatalog, parseEntityRef, mapProviderPayload };

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function signatureHeaderFor(provider, request) {
  const h = request.headers;
  if (provider === "github") return h.get("X-Hub-Signature-256") || h.get("X-Hub-Signature");
  if (provider === "linear") return h.get("Linear-Signature") || h.get("X-Linear-Signature");
  if (provider === "slack") return h.get("X-Slack-Signature");
  if (provider === "pagerduty") return h.get("X-PagerDuty-Signature");
  if (provider === "sentry") return h.get("Sentry-Hook-Signature") || h.get("sentry-hook-signature");
  return (
    h.get("X-Hub-Signature-256") ||
    h.get("X-Webhook-Signature") ||
    h.get("X-Signature") ||
    h.get("Linear-Signature")
  );
}

async function resolveSigningSecret(env, row) {
  if (row.signing_plain) return row.signing_plain;
  if (row.signing_ciphertext && row.signing_iv) {
    return decryptSecret(env, row.signing_ciphertext, row.signing_iv);
  }
  return null;
}

export async function upsertIntegrationConnection(env, input) {
  const provider = str(input.provider).toLowerCase();
  if (!INTEGRATION_PROVIDERS.includes(provider)) {
    return { ok: false, error: "unknown_provider", status: 400 };
  }
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };

  const secret = str(input.signingSecret);
  let signing_ciphertext = null;
  let signing_iv = null;
  let signing_plain = null;
  if (secret) {
    const enc = await encryptSecret(env, secret);
    if (enc) {
      signing_ciphertext = enc.ciphertext;
      signing_iv = enc.iv;
    } else if (isWebhookSecretEncryptionRequired(env)) {
      return { ok: false, error: "webhook_secret_encryption_required", status: 400 };
    } else if (isPlaintextWebhookSecretAllowed(env)) {
      signing_plain = secret;
    } else {
      return { ok: false, error: "webhook_secret_encryption_required", status: 400 };
    }
  }

  const writeToken = str(input.writeToken);
  let token_ciphertext = null;
  let token_iv = null;
  if (writeToken) {
    const encTok = await encryptSecret(env, writeToken);
    if (encTok) {
      token_ciphertext = encTok.ciphertext;
      token_iv = encTok.iv;
    } else if (isWebhookSecretEncryptionRequired(env) || hostedSharedWorkerPatForbidden(env)) {
      return { ok: false, error: "write_token_encryption_required", status: 400 };
    }
  }

  const scopes = Array.isArray(input.scopes) ? [...input.scopes] : [];
  if (input.jiraEmail) scopes.push({ jiraEmail: str(input.jiraEmail) });
  if (input.jiraSite) scopes.push({ jiraSite: str(input.jiraSite) });
  const scopesJson = JSON.stringify(scopes);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const noTrain = input.noTrain === true || provider === "slack" ? 1 : 0;
  const existing = await db
    .prepare("SELECT id FROM integration_connections WHERE project_id = ? AND provider = ?")
    .bind(input.projectId, provider)
    .first();

  if (existing?.id) {
    const sets = ["kill_switch = ?", "no_train = ?", "updated_at = ?", "scopes_json = ?"];
    const binds = [input.killSwitch ? 1 : 0, noTrain, now, scopesJson];
    if (secret) {
      sets.push("signing_ciphertext = ?", "signing_iv = ?", "signing_plain = ?");
      binds.push(signing_ciphertext, signing_iv, signing_plain);
    }
    if (writeToken && token_ciphertext) {
      sets.push("token_ciphertext = ?", "token_iv = ?");
      binds.push(token_ciphertext, token_iv);
    }
    binds.push(existing.id);
    await db
      .prepare(`UPDATE integration_connections SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    return { ok: true, connection: { id: existing.id, provider, killSwitch: Boolean(input.killSwitch) } };
  }

  await db
    .prepare(
      `INSERT INTO integration_connections (
        id, project_id, provider, kill_switch, no_train,
        signing_ciphertext, signing_iv, signing_plain,
        token_ciphertext, token_iv,
        scopes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.projectId,
      provider,
      input.killSwitch ? 1 : 0,
      noTrain,
      signing_ciphertext,
      signing_iv,
      signing_plain,
      token_ciphertext,
      token_iv,
      scopesJson,
      now,
      now,
    )
    .run();
  return { ok: true, connection: { id, provider, killSwitch: Boolean(input.killSwitch) } };
}

export async function listIntegrationConnections(env, { projectId }) {
  const db = env.DB;
  if (!db) return [];
  const { results } = await db
    .prepare(
      `SELECT id, provider, kill_switch, no_train, scopes_json, created_at, updated_at,
              signing_plain, signing_ciphertext, token_ciphertext
       FROM integration_connections WHERE project_id = ? ORDER BY provider`,
    )
    .bind(projectId)
    .all();
  return (results || []).map((r) => ({
    id: r.id,
    provider: r.provider,
    killSwitch: Boolean(r.kill_switch),
    noTrain: Boolean(r.no_train),
    scopes: JSON.parse(r.scopes_json || "[]"),
    hasSigningSecret: Boolean(r.signing_plain || r.signing_ciphertext),
    hasWriteToken: Boolean(r.token_ciphertext),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function setIntegrationKillSwitch(env, { projectId, provider, killSwitch }) {
  const p = str(provider).toLowerCase();
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };
  const now = new Date().toISOString();
  const res = await db
    .prepare(
      "UPDATE integration_connections SET kill_switch = ?, updated_at = ? WHERE project_id = ? AND provider = ?",
    )
    .bind(killSwitch ? 1 : 0, now, projectId, p)
    .run();
  if (!res.meta?.changes) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, provider: p, killSwitch: Boolean(killSwitch) };
}

export async function linkEntityRoom(env, input) {
  const ref = input.ref || parseEntityRef(input.entity);
  if (!ref) return { ok: false, error: "invalid_entity", status: 400 };
  const roomId = str(input.roomId);
  if (!roomId) return { ok: false, error: "room_id_required", status: 400 };
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO entity_room_links (id, project_id, provider, entity_type, entity_id, room_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, provider, entity_type, entity_id) DO UPDATE SET room_id = excluded.room_id`,
      )
      .bind(id, input.projectId, ref.provider, ref.type, ref.id, roomId, now)
      .run();
  } catch {
    const existing = await db
      .prepare(
        `SELECT id FROM entity_room_links WHERE project_id = ? AND provider = ? AND entity_type = ? AND entity_id = ?`,
      )
      .bind(input.projectId, ref.provider, ref.type, ref.id)
      .first();
    if (existing?.id) {
      await db
        .prepare("UPDATE entity_room_links SET room_id = ? WHERE id = ?")
        .bind(roomId, existing.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO entity_room_links (id, project_id, provider, entity_type, entity_id, room_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, input.projectId, ref.provider, ref.type, ref.id, roomId, now)
        .run();
    }
  }
  return { ok: true, link: { provider: ref.provider, type: ref.type, id: ref.id, roomId } };
}

export async function findEntityLink(env, { projectId, provider, entityType, entityId }) {
  const db = env.DB;
  if (!db) return null;
  return db
    .prepare(
      `SELECT room_id as roomId, provider, entity_type as entityType, entity_id as entityId
       FROM entity_room_links
       WHERE project_id = ? AND provider = ? AND entity_type = ? AND entity_id = ?`,
    )
    .bind(projectId, provider, entityType, entityId)
    .first();
}

async function rememberDelivery(env, { projectId, provider, deliveryKey }) {
  const key = str(deliveryKey) || `anon-${Date.now()}`;
  const db = env.DB;
  try {
    await db
      .prepare(
        `INSERT INTO integration_deliveries (id, project_id, provider, delivery_key, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), projectId, provider, key, new Date().toISOString())
      .run();
    return { duplicate: false };
  } catch {
    return { duplicate: true };
  }
}

export async function ingestIntegrationWebhook(env, { projectId, provider, rawBody, signature }) {
  const p = str(provider).toLowerCase();
  if (!INTEGRATION_PROVIDERS.includes(p)) {
    return { ok: false, error: "unknown_provider", status: 400 };
  }
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };

  const row = await db
    .prepare("SELECT * FROM integration_connections WHERE project_id = ? AND provider = ?")
    .bind(projectId, p)
    .first();
  if (!row) return { ok: false, error: "connection_missing", status: 404 };

  if (row.kill_switch) {
    return { ok: true, ignored: true, reason: "kill_switch" };
  }

  const secret = await resolveSigningSecret(env, row);
  if (!secret) return { ok: false, error: "signing_secret_missing", status: 401 };
  const verified = await verifyWebhookSignature(secret, rawBody, signature || "");
  if (!verified.valid) return { ok: false, error: "invalid_signature", status: 401 };

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "invalid_json", status: 400 };
  }

  const mapped = mapProviderPayload(p, payload);
  if (!mapped?.entityId) return { ok: true, ignored: true, reason: "unmapped" };
  if (row.no_train) mapped.noTrain = true;

  const dup = await rememberDelivery(env, {
    projectId,
    provider: p,
    deliveryKey: mapped.deliveryKey || signature?.slice(0, 32),
  });
  if (dup.duplicate) return { ok: true, duplicate: true };

  const link = await findEntityLink(env, {
    projectId,
    provider: p,
    entityType: mapped.entityType,
    entityId: mapped.entityId,
  });
  if (!link?.roomId) {
    return { ok: true, queued: false, reason: "no_entity_link", event: mapped };
  }

  try {
    await fanoutRoomInternal(env, projectId, link.roomId, "/announce", {
      type: "server_event",
      event: {
        type: "external.event",
        provider: p,
        trust: "untrusted",
        noTrain: mapped.noTrain,
        kind: mapped.kind,
        entityType: mapped.entityType,
        entityId: mapped.entityId,
        title: mapped.title,
        body: mapped.body,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    logInfo("integration.fanout_failed", { provider: p, message: String(err?.message || err) });
  }

  return { ok: true, roomId: link.roomId, event: mapped };
}

export async function resolveProjectWriteCredentials(env, { projectId, provider }) {
  const db = env.DB;
  if (!db || !projectId || !provider) return null;
  const row = await db
    .prepare(
      `SELECT token_ciphertext, token_iv, scopes_json FROM integration_connections
       WHERE project_id = ? AND provider = ? LIMIT 1`,
    )
    .bind(projectId, provider)
    .first()
    .catch(() => null);
  if (!row?.token_ciphertext || !row?.token_iv) return null;
  const token = await decryptSecret(env, row.token_ciphertext, row.token_iv);
  if (!token) return null;
  const scopes = JSON.parse(row.scopes_json || "[]");
  const extra = {};
  for (const item of scopes) {
    if (item && typeof item === "object") Object.assign(extra, item);
  }
  if (provider === "github") return { githubToken: token };
  if (provider === "linear") return { linearApiKey: token };
  if (provider === "jira") {
    return {
      jiraApiToken: token,
      jiraEmail: extra.jiraEmail || "",
      jiraBaseUrl: extra.jiraSite || extra.jiraBaseUrl || "",
    };
  }
  return null;
}

export async function createWriteIntent(env, input) {
  const provider = str(input.provider).toLowerCase();
  if (!INTEGRATION_PROVIDERS.includes(provider)) {
    return { ok: false, error: "unknown_provider", status: 400 };
  }
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };
  const dryRun = input.dryRun !== false && !input.execute;
  const id = crypto.randomUUID();
  const preview = {
    provider,
    action: str(input.action) || "comment",
    title: str(input.title).slice(0, 200),
    body: str(input.body).slice(0, 8000),
    repo: str(input.repo),
    teamId: str(input.teamId),
    projectKey: str(input.projectKey),
    dryRun,
    writesViaEnvPat: writesViaEnvPat(provider),
  };
  const payloadHash = await canonicalPayloadHash(preview);
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO integration_write_intents (
          id, project_id, room_id, provider, action, preview_json, payload_hash, status, requested_by, agent_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.projectId,
        str(input.roomId),
        provider,
        preview.action,
        JSON.stringify(preview),
        payloadHash,
        "pending",
        str(input.requestedBy),
        input.agentId || null,
        now,
      )
      .run();
  } catch {
    await db
      .prepare(
        `INSERT INTO integration_write_intents (
          id, project_id, room_id, provider, action, preview_json, status, requested_by, agent_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.projectId,
        str(input.roomId),
        provider,
        preview.action,
        JSON.stringify(preview),
        "pending",
        str(input.requestedBy),
        input.agentId || null,
        now,
      )
      .run();
  }
  return { ok: true, intent: { id, status: "pending", preview, payloadHash } };
}

export async function approveWriteIntent(env, { projectId, intentId, userId }) {
  const db = env.DB;
  if (!db) return { ok: false, error: "db_unavailable", status: 503 };
  const row = await db
    .prepare("SELECT * FROM integration_write_intents WHERE id = ? AND project_id = ?")
    .bind(intentId, projectId)
    .first();
  if (!row) return { ok: false, error: "not_found", status: 404 };
  if (row.status !== "pending") return { ok: false, error: "not_pending", status: 409 };

  const preview = JSON.parse(row.preview_json || "{}");
  const currentHash = await canonicalPayloadHash(preview);
  if (row.payload_hash && row.payload_hash !== currentHash) {
    return { ok: false, error: "payload_changed", status: 409 };
  }
  if (preview.dryRun || !writesViaEnvPat(row.provider)) {
    await db
      .prepare(
        "UPDATE integration_write_intents SET status = ?, executed_at = ?, requested_by = ? WHERE id = ?",
      )
      .bind("dry_run", new Date().toISOString(), userId || row.requested_by, row.id)
      .run();
    return { ok: true, intent: { id: row.id, status: "dry_run", preview } };
  }

  const credentials = await resolveProjectWriteCredentials(env, {
    projectId,
    provider: row.provider,
  });
  const ticket = await createExternalTicket(env, {
    provider: row.provider,
    title: preview.title || "Room follow-up",
    body: preview.body,
    repo: preview.repo,
    teamId: preview.teamId,
    projectKey: preview.projectKey,
    roomId: row.room_id,
    credentials: credentials || undefined,
  });
  if (!ticket.ok) {
    await db
      .prepare("UPDATE integration_write_intents SET status = ?, error = ? WHERE id = ?")
      .bind("error", ticket.error, row.id)
      .run();
    return { ok: false, error: ticket.error, status: ticket.status || 502 };
  }
  await db
    .prepare(
      "UPDATE integration_write_intents SET status = ?, executed_at = ?, requested_by = ? WHERE id = ?",
    )
    .bind("executed", new Date().toISOString(), userId || row.requested_by, row.id)
    .run();
  return { ok: true, intent: { id: row.id, status: "executed", ticket: ticket.ticket } };
}
