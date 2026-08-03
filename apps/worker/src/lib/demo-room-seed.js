/**
 * Idempotent welcome messages for the public demo room (FASE 1.1).
 */

const WELCOME_MESSAGES = [
  "👋 Hey there! Welcome to the FluxyChat playground.",
  "I'm an AI agent in this room — ask about architecture, SDK quickstart, or real-time features.",
  "💡 Tip: use the **+** menu for web search, image gen, or deep research.",
];

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {string} [authorUserId]
 */
export async function ensureDemoRoomSeeded(env, projectId, roomId, authorUserId = "fluxybot") {
  if (!env?.DB || !projectId || !roomId) {
    return { seeded: false, skipped: true };
  }

  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL`,
  )
    .bind(projectId, roomId)
    .first()
    .catch(() => null);

  const existing = Number(row?.c) || 0;
  if (existing > 0) {
    return { seeded: false, messageCount: existing };
  }

  const baseTs = Date.now();
  for (let i = 0; i < WELCOME_MESSAGES.length; i++) {
    const createdAt = new Date(baseTs - (WELCOME_MESSAGES.length - i) * 60_000).toISOString();
    await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(projectId, roomId, authorUserId, WELCOME_MESSAGES[i], createdAt)
      .run();
  }

  return { seeded: true, messageCount: WELCOME_MESSAGES.length };
}

export function getDemoStatus(env) {
  const enabled = env.DEMO_ENABLED === "true";
  const roomId = (env.DEMO_ROOM_ID || "").trim();
  const hasApiKey = Boolean((env.DEMO_API_KEY || "").trim());
  const configured = Boolean(roomId && hasApiKey);
  const turnstileRequired =
    Boolean(env.TURNSTILE_SECRET_KEY?.trim()) &&
    env.DEMO_ALLOW_GET_WITHOUT_TURNSTILE !== "true";

  return {
    enabled,
    configured,
    ready: enabled && configured,
    roomId: configured ? roomId : null,
    readOnly: env.DEMO_READ_ONLY === "true",
    turnstileRequired,
    agentName: (env.DEMO_AGENT_NAME || "FluxyBot").trim() || "FluxyBot",
  };
}
