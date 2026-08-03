/**
 * #47 Room Firmware — synchronous pre-fanout message hooks (builtin MVP).
 * WASM module_type reserved; unknown WASM fails open with audit warning.
 */
import { checkAndConsumeRateLimit } from "./rate-limit.js";

const PII_PATTERNS = [
  { id: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { id: "credit_card", pattern: /\b(?:\d[ -]*?){13,19}\b/ },
];

const DEFAULT_MODULES = [
  { id: "pii_veto", enabled: false },
  { id: "rate_limit", enabled: false, maxPerMinute: 30 },
  { id: "denylist", enabled: false, patterns: [] },
];

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseConfig(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return { modules: DEFAULT_MODULES };
    const modules = Array.isArray(parsed.modules) ? parsed.modules : DEFAULT_MODULES;
    return { modules };
  } catch {
    return { modules: DEFAULT_MODULES };
  }
}

function mapFirmwareRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    version: Number(row.version) || 1,
    moduleType: row.module_type || "builtin",
    capabilities: JSON.parse(row.capabilities_json || "[]"),
    config: parseConfig(row.config_json),
    wasmR2Key: row.wasm_r2_key,
    wasmModuleHash: row.wasm_module_hash,
    enabled: row.enabled === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getRoomFirmware(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_firmware WHERE project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first()
    .catch(() => null);
  return mapFirmwareRow(row);
}

export async function upsertRoomFirmware(env, { projectId, roomId, userId, patch }) {
  const existing = await getRoomFirmware(env, projectId, roomId);
  const now = new Date().toISOString();
  const config = patch.config ?? existing?.config ?? { modules: DEFAULT_MODULES };
  const enabled = patch.enabled ?? existing?.enabled ?? false;
  const moduleType = patch.moduleType ?? existing?.moduleType ?? "builtin";
  const capabilities = patch.capabilities ?? existing?.capabilities ?? [
    "message.read",
    "message.veto",
  ];
  const version = (existing?.version ?? 0) + (patch.bumpVersion ? 1 : 0) || 1;

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE room_firmware
       SET version = ?, module_type = ?, capabilities_json = ?, config_json = ?,
           enabled = ?, updated_at = ?
       WHERE id = ? AND project_id = ?`,
    )
      .bind(
        version,
        moduleType,
        JSON.stringify(capabilities),
        JSON.stringify(config),
        enabled ? 1 : 0,
        now,
        existing.id,
        projectId,
      )
      .run();
    return getRoomFirmware(env, projectId, roomId);
  }

  const id = generateId("fw");
  await env.DB.prepare(
    `INSERT INTO room_firmware (
      id, project_id, room_id, version, module_type, capabilities_json, config_json,
      wasm_r2_key, wasm_module_hash, enabled, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      roomId,
      version,
      moduleType,
      JSON.stringify(capabilities),
      JSON.stringify(config),
      enabled ? 1 : 0,
      userId,
      now,
      now,
    )
    .run();
  return getRoomFirmware(env, projectId, roomId);
}

async function auditFirmwareDecision(env, row) {
  try {
    await env.DB.prepare(
      `INSERT INTO room_firmware_audit (id, project_id, room_id, event_type, event_id, module_id, decision, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        generateId("fwa"),
        row.projectId,
        row.roomId,
        row.eventType,
        row.eventId ?? null,
        row.moduleId ?? null,
        row.decision,
        row.reason ?? null,
        new Date().toISOString(),
      )
      .run();
  } catch {
    /* non-critical */
  }
}

async function runPiiVeto(content) {
  for (const rule of PII_PATTERNS) {
    if (rule.pattern.test(content)) {
      return { action: "veto", reason: `firmware_pii_${rule.id}`, moduleId: "pii_veto" };
    }
  }
  return { action: "pass" };
}

async function runRateLimit(env, { projectId, roomId, userId, module }) {
  const max = Number(module.maxPerMinute ?? 30);
  if (!Number.isFinite(max) || max <= 0) return { action: "pass" };
  const result = await checkAndConsumeRateLimit(env, {
    key: `firmware:${projectId}:${roomId}:${userId}`,
    limit: max,
    windowSeconds: 60,
  });
  if (!result.allowed) {
    return {
      action: "veto",
      reason: "firmware_rate_limit",
      moduleId: "rate_limit",
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }
  return { action: "pass" };
}

function runDenylist(content, module) {
  const patterns = Array.isArray(module.patterns) ? module.patterns : [];
  const lower = content.toLowerCase();
  for (const raw of patterns) {
    const term = String(raw ?? "").trim().toLowerCase();
    if (term && lower.includes(term)) {
      return { action: "veto", reason: "firmware_denylist", moduleId: "denylist" };
    }
  }
  return { action: "pass" };
}

async function runBuiltinModule(env, module, input) {
  if (!module?.enabled) return { action: "pass" };
  switch (module.id) {
    case "pii_veto":
      return runPiiVeto(input.event.content ?? "");
    case "rate_limit":
      return runRateLimit(env, { ...input, module });
    case "denylist":
      return runDenylist(input.event.content ?? "", module);
    default:
      return { action: "pass" };
  }
}

/**
 * Run firmware hook synchronously before message fan-out.
 * Fail-open on internal errors (logged via audit when possible).
 */
export async function runRoomFirmwareHook(env, input) {
  const { projectId, roomId, userId, eventType, event } = input;
  if (!projectId || !roomId || eventType !== "message.create") {
    return { action: "pass", content: event?.content };
  }

  let firmware;
  try {
    firmware = await getRoomFirmware(env, projectId, roomId);
  } catch {
    return { action: "pass", content: event?.content, failOpen: true };
  }

  if (!firmware?.enabled) {
    return { action: "pass", content: event?.content };
  }

  if (firmware.moduleType === "wasm" && firmware.wasmR2Key) {
    await auditFirmwareDecision(env, {
      projectId,
      roomId,
      eventType,
      eventId: event?.clientMessageId ?? null,
      moduleId: "wasm",
      decision: "fail_open",
      reason: "wasm_runtime_not_enabled_mvp",
    });
    return { action: "pass", content: event?.content, wasmSkipped: true };
  }

  let content = event?.content ?? "";
  for (const module of firmware.config.modules ?? []) {
    let result;
    try {
      result = await runBuiltinModule(env, module, { projectId, roomId, userId, event: { ...event, content } });
    } catch {
      await auditFirmwareDecision(env, {
        projectId,
        roomId,
        eventType,
        moduleId: module.id,
        decision: "fail_open",
        reason: "module_error",
      });
      continue;
    }

    if (result.action === "veto") {
      await auditFirmwareDecision(env, {
        projectId,
        roomId,
        eventType,
        eventId: event?.clientMessageId ?? null,
        moduleId: result.moduleId ?? module.id,
        decision: "veto",
        reason: result.reason,
      });
      return {
        action: "veto",
        reason: result.reason,
        moduleId: result.moduleId,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    }

    if (result.action === "modify" && result.content != null) {
      content = result.content;
      await auditFirmwareDecision(env, {
        projectId,
        roomId,
        eventType,
        moduleId: module.id,
        decision: "modify",
        reason: result.reason ?? null,
      });
    }
  }

  return { action: "pass", content };
}

export async function listFirmwareAudit(env, { projectId, roomId, limit = 50 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM room_firmware_audit
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, roomId, Math.min(Math.max(Number(limit) || 50, 1), 200))
    .all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    eventType: row.event_type,
    eventId: row.event_id,
    moduleId: row.module_id,
    decision: row.decision,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
