/**
 * P15-H: Instant AI Room — "Intercom in 30 seconds".
 *
 * One API call creates a fully configured AI support room:
 *   • AI agent with system prompt, model, response style
 *   • Embeddable widget config
 *   • Welcome message
 *   • Escalation rules
 *   • Auto-resolve
 */

const AGENT_PRESETS = {
  support: {
    name: "Support Agent",
    systemPrompt: "You are a helpful support agent. Be concise, friendly, and solution-oriented.",
    responseStyle: "professional",
    escalationThreshold: 0.7,
  },
  sales: {
    name: "Sales Assistant",
    systemPrompt: "You are a knowledgeable sales assistant. Help users understand our product and pricing.",
    responseStyle: "enthusiastic",
    escalationThreshold: 0.6,
  },
  onboarding: {
    name: "Onboarding Guide",
    systemPrompt: "You are an onboarding guide. Help new users get started step by step.",
    responseStyle: "friendly",
    escalationThreshold: 0.8,
  },
  faq: {
    name: "FAQ Bot",
    systemPrompt: "You answer frequently asked questions. Be precise and link to documentation when available.",
    responseStyle: "concise",
    escalationThreshold: 0.5,
  },
  custom: {
    name: "AI Assistant",
    systemPrompt: "You are a helpful AI assistant.",
    responseStyle: "professional",
    escalationThreshold: 0.7,
  },
};

export async function createInstantAIRoom(env, {
  projectId, agentType = "support", agentName, agentAvatarUrl,
  agentSystemPrompt, agentModel, welcomeMessage, responseStyle,
  allowedTopics, escalationThreshold, autoResolveMinutes,
  embedEnabled, embedPosition, embedColor, embedTitle,
  roomId,
}) {
  const preset = AGENT_PRESETS[agentType] || AGENT_PRESETS.custom;
  const id = crypto.randomUUID();
  const finalRoomId = roomId || `ai-room-${id.slice(0, 8)}`;

  const config = {
    id,
    projectId,
    roomId: finalRoomId,
    agentType,
    agentName: agentName || preset.name,
    agentAvatarUrl: agentAvatarUrl || null,
    agentSystemPrompt: agentSystemPrompt || preset.systemPrompt,
    agentModel: agentModel || "gpt-4o-mini",
    welcomeMessage: welcomeMessage || `Hi! I'm ${agentName || preset.name}. How can I help you today?`,
    responseStyle: responseStyle || preset.responseStyle,
    allowedTopics: allowedTopics || [],
    escalationThreshold: escalationThreshold ?? preset.escalationThreshold,
    autoResolveMinutes: autoResolveMinutes ?? 30,
    embedEnabled: embedEnabled !== false,
    embedPosition: embedPosition || "bottom-right",
    embedColor: embedColor || "#0066ff",
    embedTitle: embedTitle || "Chat with us",
  };

  await env.DB.prepare(
    `INSERT INTO ai_room_configs (id, project_id, room_id, agent_type, agent_name, agent_avatar_url,
     agent_system_prompt, agent_model, welcome_message, response_style, allowed_topics,
     escalation_threshold, auto_resolve_minutes, embed_enabled, embed_position, embed_color, embed_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    config.id, config.projectId, config.roomId, config.agentType, config.agentName,
    config.agentAvatarUrl, config.agentSystemPrompt, config.agentModel, config.welcomeMessage,
    config.responseStyle, JSON.stringify(config.allowedTopics), config.escalationThreshold,
    config.autoResolveMinutes, config.embedEnabled ? 1 : 0, config.embedPosition,
    config.embedColor, config.embedTitle,
  ).run();

  return {
    ...config,
    embedConfig: {
      roomId: config.roomId,
      enabled: config.embedEnabled,
      position: config.embedPosition,
      color: config.embedColor,
      title: config.embedTitle,
    },
    embedSnippet: generateEmbedSnippet(config.roomId, config.embedColor, config.embedTitle),
  };
}

export async function getInstantAIRoom(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM ai_room_configs WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).first();
  if (!row) return null;
  return formatConfig(row);
}

export async function listInstantAIRooms(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ai_room_configs WHERE project_id = ? ORDER BY created_at DESC`
  ).bind(projectId).all();
  return results.map(formatConfig);
}

export async function updateInstantAIRoom(env, { projectId, roomId, updates }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM ai_room_configs WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).first();
  if (!existing) return null;

  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (["agent_type", "agent_name", "agent_avatar_url", "agent_system_prompt", "agent_model",
         "welcome_message", "response_style", "escalation_threshold", "auto_resolve_minutes",
         "embed_enabled", "embed_position", "embed_color", "embed_title"].includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      values.push(dbKey === "embed_enabled" ? (value ? 1 : 0) : (dbKey === "allowed_topics" ? JSON.stringify(value) : value));
    }
  }
  if (fields.length === 0) return formatConfig(existing);

  fields.push("updated_at = datetime('now')");
  values.push(projectId, roomId);
  await env.DB.prepare(
    `UPDATE ai_room_configs SET ${fields.join(", ")} WHERE project_id = ? AND room_id = ?`
  ).bind(...values).run();

  return getInstantAIRoom(env, { projectId, roomId });
}

export async function deleteInstantAIRoom(env, { projectId, roomId }) {
  const info = await env.DB.prepare(
    `DELETE FROM ai_room_configs WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).run();
  return info.meta?.changes > 0;
}

export async function getAgentConfig(env, { projectId, roomId }) {
  const config = await getInstantAIRoom(env, { projectId, roomId });
  if (!config || !config.enabled) return null;
  return {
    type: config.agentType,
    name: config.agentName,
    avatarUrl: config.agentAvatarUrl,
    systemPrompt: config.agentSystemPrompt,
    model: config.agentModel,
    responseStyle: config.responseStyle,
    escalationThreshold: config.escalationThreshold,
    autoResolveMinutes: config.autoResolveMinutes,
  };
}

function formatConfig(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    agentType: row.agent_type,
    agentName: row.agent_name,
    agentAvatarUrl: row.agent_avatar_url,
    agentSystemPrompt: row.agent_system_prompt,
    agentModel: row.agent_model,
    welcomeMessage: row.welcome_message,
    responseStyle: row.response_style,
    allowedTopics: JSON.parse(row.allowed_topics || "[]"),
    escalationThreshold: row.escalation_threshold,
    autoResolveMinutes: row.auto_resolve_minutes,
    enabled: row.enabled === 1,
    embedEnabled: row.embed_enabled === 1,
    embedPosition: row.embed_position,
    embedColor: row.embed_color,
    embedTitle: row.embed_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateEmbedSnippet(roomId, color, title) {
  return `<script src="https://chat.example.com/embed.js" data-room="${roomId}" data-color="${color}" data-title="${title}"></script>`;
}
