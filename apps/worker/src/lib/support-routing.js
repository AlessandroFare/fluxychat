/**
 * Smart support routing by presence + skill tags (roadmap #21).
 */

/**
 * @param {Array<{ userId: string, online?: boolean, skills?: string[], load?: number, languages?: string[] }>} agents
 * @param {{ requiredSkills?: string[], language?: string, excludeUserIds?: string[] }} criteria
 */
export function scoreSupportAgent(agent, criteria = {}) {
  if (!agent.online) return -1;
  if (criteria.excludeUserIds?.includes(agent.userId)) return -1;

  let score = 1;
  const load = Math.max(0, Number(agent.load ?? 0));
  score += Math.max(0, 10 - load);

  const skills = agent.skills ?? [];
  const required = criteria.requiredSkills ?? [];
  for (const skill of required) {
    if (skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      score += 5;
    }
  }

  if (criteria.language && agent.languages?.includes(criteria.language)) {
    score += 3;
  }

  return score;
}

export function pickBestSupportAgent(agents, criteria = {}) {
  let best = null;
  let bestScore = -1;

  for (const agent of agents) {
    const score = scoreSupportAgent(agent, criteria);
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  return bestScore > 0 ? best : null;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Live WS presence from Room DO + D1 presence_extensions.
 */
export async function fetchRoomLivePresenceUserIds(env, { projectId, roomId }) {
  const online = new Set();

  try {
    const { getPresenceSnapshot } = await import("./presence-extensions.js");
    const snapshot = await getPresenceSnapshot(env, { roomId });
    for (const uid of Object.keys(snapshot)) online.add(uid);
  } catch {
    /* non-fatal */
  }

  try {
    const { getRoomStubForProject } = await import("./room-shard.js");
    const stub = await getRoomStubForProject(env, projectId, roomId, "__support_routing__");
    const res = await stub.fetch(
      new Request("https://do-internal/live-stats", { method: "GET" }),
    );
    if (res.ok) {
      const data = await res.json();
      for (const uid of data.users || []) online.add(uid);
    }
  } catch {
    /* DO may be cold — presence_extensions still used */
  }

  return online;
}

function resolveCandidateOnline(userId, onlineIds, capRow) {
  const capacityAvailable = capRow ? capRow.is_available !== 0 : true;
  if (onlineIds.size > 0) {
    return onlineIds.has(userId) && capacityAvailable;
  }
  // No live presence signal: only route to agents explicitly marked available.
  return Boolean(capRow && capRow.is_available === 1);
}

/**
 * Load room members with real presence, agent_capacity load, and skill tags.
 */
export async function loadRoomRoutingCandidates(env, { projectId, roomId }) {
  const [rows, onlineIds, capRows] = await Promise.all([
    env.DB.prepare(
      `SELECT rm.user_id, rm.role, rm.preferences_json
       FROM room_members rm
       INNER JOIN rooms r ON r.id = rm.room_id
       WHERE r.project_id = ? AND rm.room_id = ?`,
    )
      .bind(projectId, roomId)
      .all(),
    fetchRoomLivePresenceUserIds(env, { projectId, roomId }),
    env.DB.prepare(
      `SELECT user_id, current_load, is_available, capabilities
       FROM agent_capacity WHERE project_id = ?`,
    )
      .bind(projectId)
      .all(),
  ]);

  const capByUser = new Map((capRows.results || []).map((row) => [row.user_id, row]));

  return (rows.results || []).map((row) => {
    let skills = [];
    let languages = [];
    try {
      if (row.preferences_json) {
        const prefs = JSON.parse(row.preferences_json);
        if (Array.isArray(prefs?.skills)) skills = prefs.skills;
        if (Array.isArray(prefs?.languages)) languages = prefs.languages;
      }
    } catch {
      skills = [];
      languages = [];
    }

    const cap = capByUser.get(row.user_id);
    const capSkills = parseJsonArray(cap?.capabilities);
    if (capSkills.length) {
      skills = [...new Set([...skills, ...capSkills.map(String)])];
    }

    return {
      userId: row.user_id,
      role: row.role,
      online: resolveCandidateOnline(row.user_id, onlineIds, cap),
      skills: Array.isArray(skills) ? skills : [],
      languages: Array.isArray(languages) ? languages : [],
      load: cap ? Number(cap.current_load ?? 0) : 0,
    };
  });
}

/**
 * Suggest routing target for an inbound support message.
 */
export async function suggestMessageRouting(env, input) {
  const { projectId, roomId, messageContent, senderUserId } = input;
  const candidates = await loadRoomRoutingCandidates(env, { projectId, roomId });

  const agents = candidates.filter(
    (c) =>
      c.userId !== senderUserId &&
      ["admin", "moderator", "agent", "operator"].includes(String(c.role || "")),
  );

  const pool = agents.length
    ? agents
    : candidates.filter((c) => c.userId !== senderUserId);

  const requiredSkills = [];
  const lower = String(messageContent || "").toLowerCase();
  if (lower.includes("billing") || lower.includes("invoice")) requiredSkills.push("billing");
  if (lower.includes("bug") || lower.includes("error")) requiredSkills.push("technical");
  if (lower.includes("refund")) requiredSkills.push("billing");

  const best = pickBestSupportAgent(pool, {
    requiredSkills,
    excludeUserIds: [senderUserId],
  });

  if (!best) return { ok: true, routed: false, reason: "no_online_agent" };

  return {
    ok: true,
    routed: true,
    assigneeUserId: best.userId,
    score: scoreSupportAgent(best, { requiredSkills }),
    reason: requiredSkills.length ? `skill match: ${requiredSkills.join(", ")}` : "presence",
  };
}
