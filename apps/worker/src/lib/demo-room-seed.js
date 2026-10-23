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

/**
 * Seed a "general" public room with one welcome message so a brand-new
 * project has something to look at (Area 5.1). Moved here from worker.js so
 * the id scoping is testable.
 */
export async function seedDemoRooms(env, projectId) {
  const now = new Date().toISOString();
  // Audit fix A2-21: rooms.id is a global PK — scope the starter room to the
  // project or every project after the first silently gets none (and its
  // welcome message lands in another project's room).
  const generalRoomId = `general_${projectId}`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'public', ?, ?)"
  )
    .bind(generalRoomId, projectId, "general", now)
    .run();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
  )
    .bind(generalRoomId, "fluxybot", now)
    .run();

  const configuredDemoRoom = String(env.DEMO_ROOM_ID || "").trim();
  if (configuredDemoRoom) {
    // The configured demo room is intentionally shared across projects.
    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'public', ?, ?)"
    )
      .bind(configuredDemoRoom, projectId, configuredDemoRoom, now)
      .run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    )
      .bind(configuredDemoRoom, "fluxybot", now)
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      projectId,
      generalRoomId,
      "fluxybot",
      "Welcome to FluxyChat! This is your first room. Say hi 👋",
      now,
    )
    .run();

  if (configuredDemoRoom && projectId) {
    await ensureDemoRoomSeeded(env, projectId, configuredDemoRoom, "fluxybot").catch(() => {});
  }
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
