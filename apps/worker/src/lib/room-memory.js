/**
 * P15-E: AI Memory Layer per Room
 *
 * Extracts persistent memory entries from room conversations:
 *   - decisions: decisions made in the room
 *   - faq: frequently asked questions and answers
 *   - task: action items, tasks assigned/completed
 *   - user_context: key user information mentioned
 *   - sentiment: overall room sentiment/tone
 *   - key_fact: important facts, numbers, dates mentioned
 *
 * Memory is extracted via AI and stored in D1 for instant retrieval.
 * Query: "What did we decide on pricing?" → answered from memory, not re-reading 100k messages.
 */

const MEMORY_KINDS = ["decision", "faq", "task", "user_context", "sentiment", "key_fact"];

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction engine for a chat application called FluxyChat.
Analyze the conversation transcript and extract persistent memory entries.

For each memory entry, return a JSON array of objects with:
- kind: one of "decision", "faq", "task", "user_context", "sentiment", "key_fact"
- content: concise description of the memory (1-2 sentences)
- confidence: 0.0-1.0 (how confident you are this is a real memory, not noise)
- source_indices: array of 0-based message indices that contributed to this memory

Rules:
- Only extract genuinely important information, not casual chat
- Decisions: "We decided to use X instead of Y", "Agreed on Z approach"
- FAQs: Questions asked and their answers
- Tasks: "Let's do X", "I'll handle Y", action items
- User context: "I'm based in Italy", "I prefer dark mode", key user info
- Sentiment: Overall room mood (positive/negative/neutral + reason)
- Key facts: Numbers, dates, URLs, technical specs mentioned

Return ONLY a valid JSON array. No markdown, no explanation. Empty array if nothing notable.`;

/**
 * Extract memory entries from recent messages in a room.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string }} input
 * @returns {Promise<{ ok: true, entries: Array } | { ok: false, error: string }>}
 */
export async function extractRoomMemory(env, input) {
  const { projectId, roomId } = input;

  const rows = await env.DB.prepare(
    `SELECT id, user_id, content, created_at
     FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 50`
  )
    .bind(projectId, roomId)
    .all();

  const messages = (rows.results || []).reverse();
  if (!messages.length) {
    return { ok: true, entries: [] };
  }

  const { isAiConfigured } = await import("./ai-gateway.js");
  const { chatCompletion } = await import("./ai-chat-completion.js");
  if (!isAiConfigured(env)) {
    return { ok: false, error: "ai_not_configured" };
  }

  const transcript = messages
    .map((m, i) => `[${i}] [${m.created_at}] ${m.user_id}: ${m.content}`)
    .join("\n");

  const ai = await chatCompletion(env, {
    model: env.AI_MEMORY_MODEL || env.AI_DIGEST_MODEL || env.AI_SUGGEST_MODEL || env.AI_MODEL || "openai/gpt-4o-mini",
    maxTokens: 1024,
    temperature: 0.2,
    logContext: { projectId, roomId, feature: "room_memory_extraction" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract memory entries from this conversation in room "${roomId}":\n\n${transcript}`,
      },
    ],
  });

  if (!ai.ok) {
    return { ok: false, error: ai.error };
  }

  let parsed;
  try {
    const text = ai.content.trim();
    const jsonStr = text.startsWith("[") ? text : text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "ai_parse_error" };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "invalid_format" };
  }

  const now = new Date().toISOString();
  const entries = parsed
    .filter((e) => e.kind && e.content && MEMORY_KINDS.includes(e.kind))
    .map((e) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      room_id: roomId,
      kind: e.kind,
      content: String(e.content).slice(0, 2000),
      source_message_ids: JSON.stringify(
        (e.source_indices || []).map((i) => messages[i]?.id).filter(Boolean)
      ),
      confidence: Math.min(Math.max(Number(e.confidence) || 0.8, 0), 1),
      created_at: now,
      updated_at: now,
    }));

  return { ok: true, entries };
}

/**
 * Upsert memory entries into D1, deduplicating by content hash within the same room/kind.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, entries: Array }} input
 * @returns {Promise<{ ok: true, inserted: number, updated: number }>}
 */
export async function persistRoomMemory(env, input) {
  const { projectId, roomId, entries } = input;
  if (!entries.length) return { ok: true, inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const existing = await env.DB.prepare(
      `SELECT id, confidence FROM room_memory
       WHERE project_id = ? AND room_id = ? AND kind = ? AND content = ?`
    )
      .bind(projectId, roomId, entry.kind, entry.content)
      .first();

    if (existing) {
      if (entry.confidence > existing.confidence) {
        await env.DB.prepare(
          `UPDATE room_memory SET confidence = ?, updated_at = ? WHERE id = ?`
        )
          .bind(entry.confidence, entry.updated_at, existing.id)
          .run();
        updated++;
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO room_memory (id, project_id, room_id, kind, content, source_message_ids, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          entry.id,
          entry.project_id,
          entry.room_id,
          entry.kind,
          entry.content,
          entry.source_message_ids,
          entry.confidence,
          entry.created_at,
          entry.updated_at,
        )
        .run();
      inserted++;
    }
  }

  return { ok: true, inserted, updated };
}

/**
 * Query room memory entries.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, kind?: string, limit?: number }} input
 * @returns {Promise<{ entries: Array }>}
 */
export async function queryRoomMemory(env, input) {
  const { projectId, roomId, kind } = input;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);

  let sql = `SELECT id, kind, content, source_message_ids, confidence, created_at, updated_at
    FROM room_memory
    WHERE project_id = ? AND room_id = ? AND (expires_at IS NULL OR expires_at > ?)`;
  const params = [projectId, roomId, new Date().toISOString()];

  if (kind && MEMORY_KINDS.includes(kind)) {
    sql += " AND kind = ?";
    params.push(kind);
  }

  sql += " ORDER BY confidence DESC, updated_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    entries: (rows.results || []).map((r) => ({
      id: r.id,
      kind: r.kind,
      content: r.content,
      sourceMessageIds: JSON.parse(r.source_message_ids || "[]"),
      confidence: r.confidence,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

/**
 * Delete a memory entry by ID.
 */
export async function deleteRoomMemoryEntry(env, input) {
  const { projectId, entryId } = input;
  await env.DB.prepare(
    `DELETE FROM room_memory WHERE id = ? AND project_id = ?`
  )
    .bind(entryId, projectId)
    .run();
  return { ok: true };
}

/**
 * Check if memory extraction should run for this room.
 * Runs every N messages (configurable via ROOM_MEMORY_EVERY_N).
 */
export function shouldExtractMemory(env, messageCount) {
  const everyN = Number(env.ROOM_MEMORY_EVERY_N) || 20;
  return messageCount > 0 && messageCount % everyN === 0;
}
