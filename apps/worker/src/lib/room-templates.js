/**
 * P19-H: Room Templates per Vertical.
 *
 * Pre-configured room templates for different use cases.
 * Features:
 *   • 7 built-in vertical templates (support, events, community, auctions, ops, incident, onboarding)
 *   • Custom template CRUD
 *   • Template install (creates room from template config)
 *   • Usage tracking
 *   • CP-017: Auto-apply behavior presets on install when roomId is provided
 */

import { resolveTemplatePreset, applyRoomBehaviorPreset } from "./room-template-presets.js";

const SYSTEM_TEMPLATES = [
  {
    id: "tpl-support",
    name: "Customer Support",
    slug: "support",
    description: "AI-first support room with escalation to human agents, CSAT tracking, and knowledge base integration.",
    category: "support",
    config: {
      agentPreset: "support",
      autoAssign: true,
      slaMinutes: 30,
      features: ["ai_first_response", "csat_survey", "knowledge_base", "escalation"],
      welcomeMessage: "Hi! How can we help you today?",
      inputPlaceholder: "Describe your issue...",
      agentConfig: { tone: "professional", followUpStyle: "proactive", escalationThreshold: "medium" },
    },
  },
  {
    id: "tpl-events",
    name: "Live Event",
    slug: "events",
    description: "Real-time event room with Q&A, polls, reactions, and audience engagement features.",
    category: "events",
    config: {
      agentPreset: "moderator",
      maxParticipants: 10000,
      features: ["qa_moderation", "polls", "reactions", "speaker_queue", "recording"],
      welcomeMessage: "Welcome to the event! Use /ask to submit questions.",
      eventMode: true,
      agentConfig: { tone: "enthusiastic", followUpStyle: "reactive" },
    },
  },
  {
    id: "tpl-community",
    name: "Community Hub",
    slug: "community",
    description: "Community room with reputation system, anti-spam, and moderation tools.",
    category: "community",
    config: {
      agentPreset: "moderator",
      features: ["reputation", "anti_spam", "badges", "channels", "announcements"],
      welcomeMessage: "Welcome to the community! Be respectful and have fun.",
      moderationEnabled: true,
      agentConfig: { tone: "friendly", followUpStyle: "reactive" },
    },
  },
  {
    id: "tpl-ops",
    name: "Internal Ops",
    slug: "ops",
    description: "Internal operations room with approval workflows, task tracking, and status updates.",
    category: "ops",
    config: {
      agentPreset: "ops",
      features: ["approvals", "task_tracking", "status_updates", "on_call", "broadcast"],
      welcomeMessage: "Ops room ready. Use /approve for quick decisions.",
      agentConfig: { tone: "concise", followUpStyle: "proactive", escalationThreshold: "high" },
    },
  },
  {
    id: "tpl-incident",
    name: "Incident Response",
    slug: "incident",
    description: "Dedicated incident room with timeline, on-call, alert ingestion, and postmortem workflow.",
    category: "incident",
    config: {
      agentPreset: "incident_commander",
      features: ["incident_timeline", "on_call", "alert_ingestion", "postmortem", "mttr_tracking"],
      welcomeMessage: "Incident room active. All actions are logged.",
      severity: "critical",
      agentConfig: { tone: "urgent", followUpStyle: "proactive", escalationThreshold: "low" },
    },
  },
  {
    id: "tpl-onboarding",
    name: "User Onboarding",
    slug: "onboarding",
    description: "Guided onboarding room with step-by-step setup, progress tracking, and tips.",
    category: "onboarding",
    config: {
      agentPreset: "onboarding",
      features: ["guided_setup", "progress_tracking", "tips", "checklist", "celebration"],
      welcomeMessage: "Welcome! Let's get you set up in 5 minutes.",
      agentConfig: { tone: "friendly", followUpStyle: "proactive", verbosity: "detailed" },
    },
  },
  {
    id: "tpl-auction",
    name: "Live Auction",
    slug: "auction",
    description: "Real-time bidding room with lot management, anti-sniping, and bid history.",
    category: "auctions",
    config: {
      agentPreset: "auctioneer",
      features: ["bidding", "lot_management", "anti_sniping", "bid_history", "escrow_hooks"],
      welcomeMessage: "Auction is live! Place your bids.",
      agentConfig: { tone: "energetic", followUpStyle: "reactive" },
    },
  },
];

/**
 * List all templates (system + custom).
 */
export async function listTemplates(env, { projectId, category }) {
  let custom = [];
  try {
    let sql = `SELECT * FROM room_templates WHERE (project_id = ? OR project_id IS NULL)`;
    const params = [projectId];
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY is_system DESC, usage_count DESC`;
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    custom = results || [];
  } catch (_) { /* table may not exist */ }

  // Merge system templates with custom (custom overrides by slug)
  const customBySlug = new Map(custom.filter(r => !r.is_system).map(r => [r.slug, r]));
  let system = SYSTEM_TEMPLATES.map(t => customBySlug.get(t.id) || t);
  if (category) {
    system = system.filter(t => t.category === category);
  }

  return [...system, ...custom.filter(r => r.is_system === 0)];
}

/**
 * Get a template by ID or slug.
 */
export async function getTemplate(env, { projectId, idOrSlug }) {
  // Try custom first
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM room_templates WHERE (id = ? OR slug = ?) AND (project_id = ? OR project_id IS NULL)`
    ).bind(idOrSlug, idOrSlug, projectId).first();
    if (row) return row;
  } catch (_) { /* table may not exist */ }

  // Fall back to system templates
  return SYSTEM_TEMPLATES.find(t => t.id === idOrSlug || t.slug === idOrSlug) || null;
}

/**
 * Create a custom template.
 */
export async function createTemplate(env, {
  projectId, name, slug, description, category, config,
}) {
  if (!name || !slug) return { ok: false, error: "name and slug required" };

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO room_templates (id, project_id, name, slug, description, category, config)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, slug, description || "", category || "custom", JSON.stringify(config || {}))
    .run();

  return { ok: true, id };
}

/**
 * Update a custom template.
 */
export async function updateTemplate(env, { projectId, id, ...updates }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM room_templates WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.is_system) return { ok: false, error: "cannot_modify_system_template" };

  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key === "config" ? "config" : key} = ?`);
      values.push(key === "config" ? JSON.stringify(value) : value);
    }
  }
  if (fields.length === 0) return { ok: true };

  values.push(id, projectId);
  await env.DB.prepare(
    `UPDATE room_templates SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? AND project_id = ?`
  ).bind(...values).run();

  return { ok: true };
}

/**
 * Delete a custom template.
 */
export async function deleteTemplate(env, { projectId, id }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM room_templates WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.is_system) return { ok: false, error: "cannot_delete_system_template" };

  await env.DB.prepare(`DELETE FROM room_templates WHERE id = ? AND project_id = ?`).bind(id, projectId).run();
  return { ok: true };
}

/**
 * Install a template (creates room from template config).
 * Returns the room config for the caller to create the room.
 */
export async function installTemplate(env, { projectId, templateId, roomName, roomId }) {
  const template = await getTemplate(env, { projectId, idOrSlug: templateId });
  if (!template) return { ok: false, error: "template_not_found" };

  const config = typeof template.config === "string" ? tryParse(template.config) : template.config;
  const preset = resolveTemplatePreset({
    slug: template.slug,
    category: template.category,
    config,
  });

  // Increment usage count
  try {
    await env.DB.prepare(
      `UPDATE room_templates SET usage_count = usage_count + 1 WHERE id = ?`
    ).bind(template.id).run();
  } catch (_) { /* non-critical */ }

  if (roomId) {
    await applyRoomBehaviorPreset(env, {
      projectId,
      roomId,
      templateSlug: template.slug,
      preset,
      welcomeMessage: config?.welcomeMessage,
      inputPlaceholder: config?.inputPlaceholder,
    }).catch(() => {});
  }

  return {
    ok: true,
    template: {
      id: template.id,
      name: template.name,
      slug: template.slug,
      category: template.category,
    },
    roomConfig: {
      name: roomName || `${template.name} Room`,
      settings: config,
      agentPreset: config.agentPreset,
      features: config.features,
      welcomeMessage: config.welcomeMessage,
    },
    behaviorPreset: preset,
  };
}

function tryParse(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
