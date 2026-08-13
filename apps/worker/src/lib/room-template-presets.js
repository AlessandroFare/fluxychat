/**
 * CP-017: Stream-style use-case presets — auto-config room behavior on template install.
 */

/** @typedef {{ typingIndicatorsEnabled: boolean, readReceiptsEnabled: boolean, features: string[] }} RoomPreset */

const PRESETS_BY_SLUG = {
  events: {
    typingIndicatorsEnabled: false,
    readReceiptsEnabled: false,
    features: ["qa_moderation", "polls", "reactions", "speaker_queue", "recording"],
  },
  auction: {
    typingIndicatorsEnabled: false,
    readReceiptsEnabled: true,
    features: ["bidding", "lot_management", "anti_sniping", "bid_history"],
  },
  support: {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    features: ["ai_first_response", "csat_survey", "knowledge_base", "escalation"],
  },
  community: {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    features: ["reputation", "anti_spam", "badges", "moderation"],
  },
  ops: {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    features: ["approvals", "task_tracking", "on_call"],
  },
  incident: {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    features: ["incident_timeline", "on_call", "alert_ingestion", "mttr_tracking"],
  },
  onboarding: {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: false,
    features: ["guided_setup", "progress_tracking", "checklist"],
  },
};

/**
 * Resolve preset flags from template config.
 * @param {{ slug?: string, category?: string, config?: Record<string, unknown> }} template
 */
export function resolveTemplatePreset(template) {
  const slug = String(template.slug || template.category || "").toLowerCase();
  const base = PRESETS_BY_SLUG[slug] || {
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    features: [],
  };

  const config = template.config && typeof template.config === "object" ? template.config : {};
  if (config.eventMode === true || config.maxParticipants > 1000) {
    return PRESETS_BY_SLUG.events;
  }

  return {
    typingIndicatorsEnabled: config.typingIndicatorsEnabled ?? base.typingIndicatorsEnabled,
    readReceiptsEnabled: config.readReceiptsEnabled ?? base.readReceiptsEnabled,
    features: Array.isArray(config.features) ? config.features : base.features,
  };
}

/**
 * Persist behavior settings for a room after template install.
 */
export async function applyRoomBehaviorPreset(env, {
  projectId,
  roomId,
  templateSlug,
  preset,
  welcomeMessage,
  inputPlaceholder,
}) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_behavior_settings (
       room_id, project_id, typing_indicators_enabled, read_receipts_enabled,
       welcome_message, input_placeholder, template_slug, preset_features_json,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id, project_id) DO UPDATE SET
       typing_indicators_enabled = excluded.typing_indicators_enabled,
       read_receipts_enabled = excluded.read_receipts_enabled,
       welcome_message = excluded.welcome_message,
       input_placeholder = excluded.input_placeholder,
       template_slug = excluded.template_slug,
       preset_features_json = excluded.preset_features_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      roomId,
      projectId,
      preset.typingIndicatorsEnabled ? 1 : 0,
      preset.readReceiptsEnabled ? 1 : 0,
      welcomeMessage || null,
      inputPlaceholder || null,
      templateSlug || null,
      JSON.stringify(preset.features || []),
      now,
      now,
    )
    .run();
  return { ok: true };
}

export async function getRoomBehaviorSettings(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_behavior_settings WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();
  if (!row) {
    return {
      typingIndicatorsEnabled: true,
      readReceiptsEnabled: true,
      welcomeMessage: null,
      inputPlaceholder: null,
      templateSlug: null,
      features: [],
    };
  }
  let features = [];
  try {
    features = row.preset_features_json ? JSON.parse(row.preset_features_json) : [];
  } catch {
    features = [];
  }
  return {
    typingIndicatorsEnabled: row.typing_indicators_enabled === 1,
    readReceiptsEnabled: row.read_receipts_enabled === 1,
    welcomeMessage: row.welcome_message,
    inputPlaceholder: row.input_placeholder,
    templateSlug: row.template_slug,
    features,
  };
}
