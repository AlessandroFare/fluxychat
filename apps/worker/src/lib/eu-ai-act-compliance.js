/**
 * EU AI Act (Regulation 2024/1689) — settings, agent profiles, assessment, runtime enforcement.
 * Not legal advice; supports technical controls for conformity documentation.
 */

import { getProjectConsentSettings } from "./consent-dpa.js";
import { getProjectResidencySettings } from "./data-residency-settings.js";
import { getGovernanceRegistry } from "./ai-governance-registry.js";
import { createApprovalGate } from "./hitl-approval.js";

export const EU_RISK_CATEGORIES = new Set(["minimal", "limited", "high", "unacceptable"]);
export const HUMAN_OVERSIGHT_LEVELS = new Set(["human_in_loop", "human_on_loop", "human_in_command"]);
export const HITL_MODES = new Set(["none", "side_effect", "all_tools"]);

/** Tools with material side effects — Art. 14 human oversight default for high-risk. */
export const SIDE_EFFECT_TOOL_NAMES = new Set([
  "postMessage",
  "send_message",
  "sendMessage",
  "editMessage",
  "deleteMessage",
  "banUser",
  "muteUser",
  "lockRoom",
  "call_webhook",
  "http_request",
  "run_script",
  "escalate",
  "create_ticket",
  "assign_agent",
  "notify",
]);

export const ANNEX_III_CATEGORIES = [
  { id: "none", label: "Not Annex III (general purpose / minimal risk)" },
  { id: "biometric", label: "Annex III §1 — Biometric identification" },
  { id: "critical_infrastructure", label: "Annex III §2 — Critical infrastructure" },
  { id: "education", label: "Annex III §3 — Education & vocational training" },
  { id: "employment", label: "Annex III §4 — Employment & worker management" },
  { id: "essential_services", label: "Annex III §5 — Essential private/public services" },
  { id: "law_enforcement", label: "Annex III §6 — Law enforcement" },
  { id: "migration", label: "Annex III §7 — Migration & border control" },
  { id: "justice", label: "Annex III §8 — Administration of justice" },
  { id: "democratic_processes", label: "Annex III §9 — Democratic processes" },
];

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mapSettingsRow(row) {
  if (!row) {
    return {
      enabled: true,
      providerLegalName: null,
      providerContact: null,
      enforceAiDisclosure: true,
      enforceHitlHighRisk: true,
      recordRetentionDays: 365,
      requireConformityForHighRisk: true,
      blockUnacceptableRisk: true,
      updatedAt: null,
      configured: false,
    };
  }
  return {
    enabled: row.enabled !== 0,
    providerLegalName: row.provider_legal_name ?? null,
    providerContact: row.provider_contact ?? null,
    enforceAiDisclosure: row.enforce_ai_disclosure !== 0,
    enforceHitlHighRisk: row.enforce_hitl_high_risk !== 0,
    recordRetentionDays: row.record_retention_days ?? 365,
    requireConformityForHighRisk: row.require_conformity_for_high_risk !== 0,
    blockUnacceptableRisk: row.block_unacceptable_risk !== 0,
    updatedAt: row.updated_at,
    configured: true,
  };
}

function mapProfileRow(row) {
  if (!row) return null;
  let dataCategories = [];
  if (row.data_categories_json) {
    try {
      const parsed = JSON.parse(row.data_categories_json);
      dataCategories = Array.isArray(parsed) ? parsed : [];
    } catch {
      dataCategories = [];
    }
  }
  return {
    id: row.id,
    agentId: row.agent_id,
    intendedPurpose: row.intended_purpose,
    euRiskCategory: row.eu_risk_category,
    annexIIICategory: row.annex_iii_category ?? null,
    humanOversightLevel: row.human_oversight_level,
    hitlMode: row.hitl_mode,
    requiresDisclosure: row.requires_disclosure === 1,
    dataCategories,
    prohibitedUseConfirmed: row.prohibited_use_confirmed === 1,
    conformityAssessed: row.conformity_assessed === 1,
    conformityAssessedAt: row.conformity_assessed_at ?? null,
    conformityAssessedBy: row.conformity_assessed_by ?? null,
    technicalDocVersion: row.technical_doc_version || "1.0",
    updatedAt: row.updated_at,
  };
}

export async function getProjectEuAiActSettings(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT enabled, provider_legal_name, provider_contact, enforce_ai_disclosure,
            enforce_hitl_high_risk, record_retention_days, require_conformity_for_high_risk,
            block_unacceptable_risk, updated_at
     FROM project_eu_ai_act_settings WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();
  return mapSettingsRow(row);
}

export async function upsertProjectEuAiActSettings(env, projectId, input) {
  const now = new Date().toISOString();
  const retention = Math.max(30, Math.min(3650, Number(input.recordRetentionDays) || 365));
  await env.DB.prepare(
    `INSERT INTO project_eu_ai_act_settings
       (project_id, enabled, provider_legal_name, provider_contact, enforce_ai_disclosure,
        enforce_hitl_high_risk, record_retention_days, require_conformity_for_high_risk,
        block_unacceptable_risk, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       enabled = excluded.enabled,
       provider_legal_name = excluded.provider_legal_name,
       provider_contact = excluded.provider_contact,
       enforce_ai_disclosure = excluded.enforce_ai_disclosure,
       enforce_hitl_high_risk = excluded.enforce_hitl_high_risk,
       record_retention_days = excluded.record_retention_days,
       require_conformity_for_high_risk = excluded.require_conformity_for_high_risk,
       block_unacceptable_risk = excluded.block_unacceptable_risk,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      input.enabled === false ? 0 : 1,
      input.providerLegalName?.trim() || null,
      input.providerContact?.trim() || null,
      input.enforceAiDisclosure === false ? 0 : 1,
      input.enforceHitlHighRisk === false ? 0 : 1,
      retention,
      input.requireConformityForHighRisk === false ? 0 : 1,
      input.blockUnacceptableRisk === false ? 0 : 1,
      now,
    )
    .run();
  await logEuAiActEvent(env, {
    projectId,
    eventType: "settings_updated",
    metadata: { retention },
  });
  return getProjectEuAiActSettings(env, projectId);
}

export async function listAgentEuAiActProfiles(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agent_eu_ai_act_profiles WHERE project_id = ? ORDER BY updated_at DESC`,
  )
    .bind(projectId)
    .all();
  return (rows.results ?? []).map(mapProfileRow).filter(Boolean);
}

export async function getAgentEuAiActProfile(env, projectId, agentId) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_eu_ai_act_profiles WHERE project_id = ? AND agent_id = ?`,
  )
    .bind(projectId, agentId)
    .first();
  return mapProfileRow(row);
}

export async function upsertAgentEuAiActProfile(env, projectId, agentId, input, actorId) {
  if (!agentId?.trim()) return { error: "agent_id_required" };
  if (!input.intendedPurpose?.trim()) return { error: "intended_purpose_required" };

  const euRiskCategory = input.euRiskCategory || "minimal";
  if (!EU_RISK_CATEGORIES.has(euRiskCategory)) {
    return { error: "invalid_eu_risk_category" };
  }
  const humanOversightLevel = input.humanOversightLevel || "human_in_loop";
  if (!HUMAN_OVERSIGHT_LEVELS.has(humanOversightLevel)) {
    return { error: "invalid_human_oversight_level" };
  }
  const hitlMode = input.hitlMode || (euRiskCategory === "high" ? "side_effect" : "none");
  if (!HITL_MODES.has(hitlMode)) return { error: "invalid_hitl_mode" };

  const bot = await env.DB.prepare(`SELECT id, name FROM bots WHERE id = ? AND project_id = ?`)
    .bind(agentId, projectId)
    .first();
  if (!bot) return { error: "agent_not_found" };

  const now = new Date().toISOString();
  const id = input.id || generateId("euai");
  const requiresDisclosure =
    input.requiresDisclosure === false
      ? 0
      : euRiskCategory === "limited" || euRiskCategory === "high"
        ? 1
        : input.requiresDisclosure === true
          ? 1
          : 0;

  await env.DB.prepare(
    `INSERT INTO agent_eu_ai_act_profiles
       (id, project_id, agent_id, intended_purpose, eu_risk_category, annex_iii_category,
        human_oversight_level, hitl_mode, requires_disclosure, data_categories_json,
        prohibited_use_confirmed, conformity_assessed, conformity_assessed_at,
        conformity_assessed_by, technical_doc_version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, agent_id) DO UPDATE SET
       intended_purpose = excluded.intended_purpose,
       eu_risk_category = excluded.eu_risk_category,
       annex_iii_category = excluded.annex_iii_category,
       human_oversight_level = excluded.human_oversight_level,
       hitl_mode = excluded.hitl_mode,
       requires_disclosure = excluded.requires_disclosure,
       data_categories_json = excluded.data_categories_json,
       prohibited_use_confirmed = excluded.prohibited_use_confirmed,
       conformity_assessed = excluded.conformity_assessed,
       conformity_assessed_at = excluded.conformity_assessed_at,
       conformity_assessed_by = excluded.conformity_assessed_by,
       technical_doc_version = excluded.technical_doc_version,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      projectId,
      agentId,
      input.intendedPurpose.trim(),
      euRiskCategory,
      input.annexIIICategory?.trim() || null,
      humanOversightLevel,
      hitlMode,
      requiresDisclosure,
      JSON.stringify(input.dataCategories ?? []),
      input.prohibitedUseConfirmed === false ? 0 : 1,
      input.conformityAssessed === true ? 1 : 0,
      input.conformityAssessed === true ? now : null,
      input.conformityAssessed === true ? actorId ?? null : null,
      input.technicalDocVersion?.trim() || "1.0",
      now,
    )
    .run();

  await logEuAiActEvent(env, {
    projectId,
    agentId,
    eventType: "agent_profile_updated",
    euRiskCategory,
    metadata: { intendedPurpose: input.intendedPurpose.trim() },
  });

  return { profile: await getAgentEuAiActProfile(env, projectId, agentId) };
}

export async function logEuAiActEvent(env, { projectId, agentId, roomId, eventType, euRiskCategory, metadata }) {
  const id = generateId("euai_log");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO eu_ai_act_audit_log
       (id, project_id, agent_id, room_id, event_type, eu_risk_category, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      agentId ?? null,
      roomId ?? null,
      eventType,
      euRiskCategory ?? null,
      metadata ? JSON.stringify(metadata) : null,
      now,
    )
    .run();
  return { id, createdAt: now };
}

export async function listEuAiActAuditLog(env, projectId, { limit = 100, agentId } = {}) {
  const capped = Math.min(500, Math.max(1, limit));
  let sql = `SELECT id, project_id, agent_id, room_id, event_type, eu_risk_category, metadata_json, created_at
             FROM eu_ai_act_audit_log WHERE project_id = ?`;
  const binds = [projectId];
  if (agentId) {
    sql += ` AND agent_id = ?`;
    binds.push(agentId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(capped);
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    roomId: row.room_id,
    eventType: row.event_type,
    euRiskCategory: row.eu_risk_category,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
  }));
}

function sideEffectToolsFromSchema(tools) {
  if (!Array.isArray(tools)) return [...SIDE_EFFECT_TOOL_NAMES];
  const names = tools.map((t) => t?.name || t?.function?.name).filter(Boolean);
  return names.filter((n) => SIDE_EFFECT_TOOL_NAMES.has(n));
}

/**
 * Runtime policy merge for agent-runtime.js (Art. 13–14 enforcement).
 */
export async function resolveEuAiActRuntimePolicy(env, { projectId, agentId, agentName, tools, agentConfig }) {
  const settings = await getProjectEuAiActSettings(env, projectId);
  if (!settings.enabled) {
    return { blocked: false, approvalGate: null, systemPromptSuffix: "", messageMetadata: null };
  }

  const profile = await getAgentEuAiActProfile(env, projectId, agentId);
  const category = profile?.euRiskCategory ?? "minimal";

  if (settings.blockUnacceptableRisk && category === "unacceptable") {
    return {
      blocked: true,
      error: "eu_ai_act_unacceptable_risk",
      message: "This agent is classified as unacceptable risk under your EU AI Act policy and cannot run.",
    };
  }

  if (
    settings.requireConformityForHighRisk &&
    category === "high" &&
    profile &&
    !profile.conformityAssessed
  ) {
    return {
      blocked: true,
      error: "eu_ai_act_conformity_required",
      message:
        "High-risk agent requires conformity assessment before production use. Complete it in AI Governance → EU AI Act.",
    };
  }

  let approvalGate = agentConfig?.approvalGate ? createApprovalGate(agentConfig.approvalGate) : null;
  const hitlMode = profile?.hitlMode ?? (category === "high" && settings.enforceHitlHighRisk ? "side_effect" : "none");
  const mustEnforceHitl =
    settings.enforceHitlHighRisk && (category === "high" || hitlMode === "all_tools" || hitlMode === "side_effect");

  if (mustEnforceHitl && hitlMode !== "none") {
    const sideEffects = sideEffectToolsFromSchema(tools);
    const alwaysRequire =
      hitlMode === "all_tools"
        ? (Array.isArray(tools) ? tools.map((t) => t?.name || t?.function?.name).filter(Boolean) : [...SIDE_EFFECT_TOOL_NAMES])
        : sideEffects;
    const existing = agentConfig?.approvalGate || {};
    const mergedAlways = [...new Set([...(existing.alwaysRequire ?? []), ...alwaysRequire])];
    approvalGate = createApprovalGate({
      ...existing,
      alwaysRequire: mergedAlways,
    });
  }

  const needsDisclosure =
    (settings.enforceAiDisclosure && (profile?.requiresDisclosure || category === "limited" || category === "high")) ||
    profile?.requiresDisclosure;

  const disclosureLabel = agentName ? `${agentName} (AI)` : "AI assistant";
  const systemPromptSuffix = needsDisclosure
    ? `\n\n[EU AI Act transparency] You are an AI system. Identify yourself as "${disclosureLabel}" when asked or when your output could be mistaken for a human. Do not impersonate a human operator.`
    : "";

  const messageMetadata = needsDisclosure
    ? {
        aiGenerated: true,
        aiDisclosure: disclosureLabel,
        euAiActRiskCategory: category,
        humanOversightLevel: profile?.humanOversightLevel ?? null,
      }
    : { euAiActRiskCategory: category };

  return {
    blocked: false,
    approvalGate,
    systemPromptSuffix,
    messageMetadata,
    profile,
    settings,
  };
}

export async function assessEuAiActCompliance(env, projectId) {
  const settings = await getProjectEuAiActSettings(env, projectId);
  const profiles = await listAgentEuAiActProfiles(env, projectId);
  const consent = await getProjectConsentSettings(env, projectId);
  const residency = await getProjectResidencySettings(env, projectId).catch(() => null);
  const registry = await getGovernanceRegistry(env, { projectId });

  const bots = await env.DB.prepare(`SELECT id, name FROM bots WHERE project_id = ?`).bind(projectId).all();
  const agentIds = (bots.results ?? []).map((b) => b.id);
  const profileByAgent = new Map(profiles.map((p) => [p.agentId, p]));

  const gaps = [];

  if (!settings.providerLegalName?.trim()) {
    gaps.push({
      id: "provider_identity",
      article: "Art. 16 / Art. 25",
      severity: "high",
      title: "Provider legal identity missing",
      detail: "Set provider legal name and contact in EU AI Act settings for deployer/provider obligations.",
      fixPath: "/ai-governance/eu-ai-act",
    });
  }

  if (!consent.enabled && residency?.region?.startsWith("eu")) {
    gaps.push({
      id: "eu_consent",
      article: "Art. 10 / GDPR",
      severity: "medium",
      title: "EU consent banner disabled",
      detail: "Enable EU consent + DPA for EU data subjects.",
      fixPath: "/settings/consent",
    });
  }

  if (!residency?.region) {
    gaps.push({
      id: "data_residency",
      article: "Art. 10",
      severity: "medium",
      title: "Data residency not configured",
      detail: "Pin storage region for EU deployers.",
      fixPath: "/settings/residency",
    });
  }

  if (registry.models.length === 0 && agentIds.length > 0) {
    gaps.push({
      id: "governance_registry",
      article: "Art. 11 / Art. 53 GPAI",
      severity: "medium",
      title: "No models in AI governance registry",
      detail: "Register each foundation model ID used by agents.",
      fixPath: "/ai-governance",
    });
  }

  for (const agentId of agentIds) {
    const bot = bots.results.find((b) => b.id === agentId);
    const profile = profileByAgent.get(agentId);
    if (!profile) {
      gaps.push({
        id: `agent_profile_${agentId}`,
        article: "Art. 11",
        severity: "high",
        title: `Agent "${bot?.name ?? agentId}" has no EU AI Act profile`,
        detail: "Document intended purpose and risk category before production.",
        fixPath: "/ai-governance/eu-ai-act",
      });
      continue;
    }
    if (profile.euRiskCategory === "high") {
      if (settings.enforceHitlHighRisk && profile.hitlMode === "none") {
        gaps.push({
          id: `hitl_${agentId}`,
          article: "Art. 14",
          severity: "critical",
          title: `High-risk agent "${bot?.name}" without human oversight (HITL)`,
          detail: "Enable side_effect or all_tools HITL mode.",
          fixPath: "/ai-governance/eu-ai-act",
        });
      }
      if (settings.requireConformityForHighRisk && !profile.conformityAssessed) {
        gaps.push({
          id: `conformity_${agentId}`,
          article: "Art. 43",
          severity: "critical",
          title: `High-risk agent "${bot?.name}" missing conformity assessment`,
          detail: "Mark conformity assessed after internal review.",
          fixPath: "/ai-governance/eu-ai-act",
        });
      }
      if (!profile.annexIIICategory || profile.annexIIICategory === "none") {
        gaps.push({
          id: `annex_${agentId}`,
          article: "Annex III",
          severity: "high",
          title: `High-risk agent "${bot?.name}" missing Annex III category`,
          detail: "Select the applicable high-risk domain.",
          fixPath: "/ai-governance/eu-ai-act",
        });
      }
    }
    if (
      settings.enforceAiDisclosure &&
      (profile.euRiskCategory === "limited" || profile.euRiskCategory === "high") &&
      !profile.requiresDisclosure
    ) {
      gaps.push({
        id: `disclosure_${agentId}`,
        article: "Art. 50",
        severity: "high",
        title: `Agent "${bot?.name}" missing AI disclosure requirement`,
        detail: "Enable transparency disclosure for limited/high-risk agents.",
        fixPath: "/ai-governance/eu-ai-act",
      });
    }
  }

  if (settings.recordRetentionDays < 180) {
    gaps.push({
      id: "retention",
      article: "Art. 12",
      severity: "medium",
      title: "Record retention below 180 days",
      detail: "Increase automatic log retention for high-risk traceability.",
      fixPath: "/ai-governance/eu-ai-act",
    });
  }

  const critical = gaps.filter((g) => g.severity === "critical").length;
  const high = gaps.filter((g) => g.severity === "high").length;
  const score = Math.max(0, 100 - critical * 25 - high * 10 - gaps.length * 2);

  return {
    assessedAt: new Date().toISOString(),
    projectId,
    score,
    readyForProduction: critical === 0 && high === 0,
    summary: {
      agents: agentIds.length,
      profiles: profiles.length,
      gaps: gaps.length,
      critical,
      high,
    },
    gaps,
    settings,
  };
}

export async function buildEuAiActTechnicalDocumentation(env, projectId) {
  const settings = await getProjectEuAiActSettings(env, projectId);
  const profiles = await listAgentEuAiActProfiles(env, projectId);
  const registry = await getGovernanceRegistry(env, { projectId });
  const bots = await env.DB.prepare(
    `SELECT id, name, provider, model, system_prompt, config FROM bots WHERE project_id = ?`,
  )
    .bind(projectId)
    .all();

  const agents = (bots.results ?? []).map((row) => {
    const profile = profiles.find((p) => p.agentId === row.id);
    let config = null;
    try {
      config = row.config ? JSON.parse(row.config) : null;
    } catch {
      config = null;
    }
    return {
      agentId: row.id,
      name: row.name,
      model: row.model,
      provider: row.provider,
      intendedPurpose: profile?.intendedPurpose ?? null,
      euRiskCategory: profile?.euRiskCategory ?? "unclassified",
      annexIIICategory: profile?.annexIIICategory ?? null,
      humanOversightLevel: profile?.humanOversightLevel ?? null,
      hitlMode: profile?.hitlMode ?? null,
      dataCategories: profile?.dataCategories ?? [],
      conformityAssessed: profile?.conformityAssessed ?? false,
      technicalDocVersion: profile?.technicalDocVersion ?? "1.0",
      toolPreset: config?.toolPreset ?? null,
    };
  });

  return {
    documentType: "eu_ai_act_annex_iv_technical_documentation",
    regulation: "Regulation (EU) 2024/1689",
    generatedAt: new Date().toISOString(),
    projectId,
    provider: {
      legalName: settings.providerLegalName,
      contact: settings.providerContact,
    },
    systemOverview: {
      description: "FluxyChat in-room AI agents with tool calling, HITL approvals, moderation, and audit logging.",
      recordRetentionDays: settings.recordRetentionDays,
      enforceAiDisclosure: settings.enforceAiDisclosure,
      enforceHitlHighRisk: settings.enforceHitlHighRisk,
    },
    agents,
    governanceRegistry: registry,
    controls: {
      transparency: ["Agent disclosure labels", "Streaming agent_step events", "Art. 50 metadata on messages"],
      humanOversight: ["HITL tool approvals", "Moderation queue", "Agent queue handoff", "Async decisions"],
      logging: ["agent_runs D1 table", "eu_ai_act_audit_log", "OTel export", "SOC 2 evidence"],
      dataGovernance: ["EU consent/DPA", "Data residency", "PII redaction middleware", "Retention policies"],
    },
    disclaimer: "Generated technical documentation for internal conformity files. Not a legal conformity certificate.",
  };
}
