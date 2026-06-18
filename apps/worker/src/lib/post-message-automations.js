import { logError } from "./worker-log.js";
import { deliverWebhooks } from "./webhook-delivery.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";
import { maybeNotifyOfflineSms } from "./offline-notify-sent.js";
import { maybePushNotifyOnMessage } from "./push-notifications.js";
import { fanoutRoomInternal } from "./room-shard.js";

/** Audit C-3: max allowed depth for nested automations. */
export const AUTOMATION_MAX_DEPTH = 3;

export async function schedulePostMessageAutomations(env, detail) {
  // Audit C-3: refuse to run if the depth exceeds the limit. This
  // prevents an automation that posts a message from triggering
  // another automation that posts a message, ad infinitum, which
  // would amplify a single user message into an unbounded cascade.
  const depth = Number(detail?.depth ?? 0);
  if (depth > AUTOMATION_MAX_DEPTH) {
    logError("automation.depth_exceeded", new Error("automation_depth_exceeded"), {
      projectId: detail?.projectId,
      roomId: detail?.roomId,
      messageId: detail?.messageId,
      depth,
      maxDepth: AUTOMATION_MAX_DEPTH,
    });
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS operational_audit_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          message_id TEXT,
          room_id TEXT,
          user_id TEXT,
          error_message TEXT,
          error_stack TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        )
      `).run();
      await env.DB.prepare(
        `INSERT INTO operational_audit_events
           (project_id, event_type, message_id, room_id, details, created_at)
         VALUES (?, 'AUTOMATION_DEPTH_EXCEEDED', ?, ?, ?, ?)`
      )
        .bind(
          detail?.projectId || null,
          detail?.messageId != null ? String(detail.messageId) : null,
          detail?.roomId || null,
          JSON.stringify({ depth, maxDepth: AUTOMATION_MAX_DEPTH }),
          new Date().toISOString(),
        )
        .run();
    } catch {
      // best effort; never throw from this path
    }
    return;
  }

  try {
    await Promise.all([
      maybeTriggerAutoRoomSummary(env, detail.projectId, detail.roomId),
      maybeRunBuiltinModerationScan(env, detail),
      maybeRunAiModerationScan(env, detail),
      maybeNotifyOfflineSms(env, detail),
      maybePushNotifyOnMessage(env, detail),
      maybeExtractRoomMemory(env, detail),
      maybeStoreMessageEmbedding(env, detail),
      maybeExtractKnowledgeGraph(env, detail),
    ]);
  } catch (err) {
    logError("post_message_automations_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
    });
  }
}

async function maybeRunBuiltinModerationScan(env, opts) {
  const {
    projectId,
    roomId,
    authorUserId,
    messageId,
    content,
    traceId,
  } = opts;

  try {
    if (
      env.BUILTIN_MODERATION_ENABLED !== "true" &&
      env.BUILTIN_MODERATION_ENABLED !== "1"
    ) {
      return;
    }
    const raw = env.BUILTIN_MODERATION_BLOCKED_SUBSTRINGS || "";
    const tokens = raw
      .split(",")
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    if (!tokens.length) return;
    if (content === undefined || content === null) return;
    const hay = String(content).toLowerCase();
    const hitToken = tokens.find((tok) => hay.includes(tok));
    if (!hitToken) return;

    const mid = Number(messageId);
    if (!Number.isFinite(mid)) return;

    const dup = await env.DB.prepare(
      "SELECT 1 AS ok FROM moderation_events WHERE project_id = ? AND target_message_id = ? AND action = 'auto_flag' LIMIT 1"
    )
      .bind(projectId, mid)
      .first();
    if (dup?.ok) return;

    const now = new Date().toISOString();
    const reason = `builtin_substring:${hitToken.slice(0, 80)}`;

    const insert = await env.DB.prepare(
      "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(projectId, roomId, "builtin", "auto_flag", reason, now, mid)
      .run();

    const moderationEventId = insert.meta.last_row_id;

    // Audit B-2: use the idempotency_key from migration 0141 to dedup
    // re-enqueues from ctx.waitUntil re-fires or cron replays.
    const idempotencyKey = `moderation_builtin_flag:${projectId}:${mid}`;
    await env.DB.prepare(
      `INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, idempotency_key) DO NOTHING`
    )
      .bind(
        projectId,
        "moderation_builtin_flag",
        roomId,
        JSON.stringify({
          moderationEventId,
          messageId: mid,
          matched: hitToken,
          authorUserId,
          traceId: traceId || null,
        }),
        now,
        idempotencyKey,
      )
      .run();

    await deliverWebhooks(env, projectId, "moderation.auto_flag", {
      moderationEventId,
      roomId,
      messageId: mid,
      authorUserId,
      matchedSubstring: hitToken,
      traceId: traceId || null,
    });
  } catch (err) {
    logError("automation.builtin_moderation_failed", err, {
      projectId,
      roomId,
      messageId,
    });
  }
}

async function maybeTriggerAutoRoomSummary(env, projectId, roomId) {
  try {
    if (
      env.AUTO_ROOM_SUMMARY_ENABLED !== "true" &&
      env.AUTO_ROOM_SUMMARY_ENABLED !== "1"
    ) {
      return;
    }
    const { isAiConfigured } = await import("./ai-gateway.js");
    if (!isAiConfigured(env)) return;
    const everyN = Number(env.AUTO_ROOM_SUMMARY_EVERY_N || 0);
    if (!Number.isFinite(everyN) || everyN <= 0) return;

    const countRow = await env.DB.prepare(
      "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL"
    )
      .bind(projectId, roomId)
      .first();
    const total = Number(countRow?.c ?? 0);
    if (total < everyN || total % everyN !== 0) return;

    const cooldownMin = Number(env.AUTO_ROOM_SUMMARY_COOLDOWN_MINUTES ?? 120);
    const cooldownMs = Math.max(0, cooldownMin) * 60_000;

    if (cooldownMs > 0) {
      const last = await env.DB.prepare(
        "SELECT created_at FROM automation_events WHERE project_id = ? AND room_id = ? AND event_type IN ('room_summary_auto', 'room_summary') ORDER BY id DESC LIMIT 1"
      )
        .bind(projectId, roomId)
        .first();
      if (last?.created_at) {
        const elapsed = Date.now() - Date.parse(last.created_at);
        if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < cooldownMs) {
          return;
        }
      }
    }

    const createdAt = new Date().toISOString();
    // Audit B-2: idempotency key dedups re-enqueues from
    // ctx.waitUntil re-fires or cron replays.
    const idempotencyKey = `room_summary_auto:${projectId}:${roomId}:${createdAt}`;
    await env.DB.prepare(
      `INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, idempotency_key) DO NOTHING`
    )
      .bind(
        projectId,
        "room_summary_auto",
        roomId,
        JSON.stringify({
          trigger: "every_n_messages",
          everyN,
          totalMessages: total,
        }),
        createdAt,
        idempotencyKey,
      )
      .run();

    await generateRoomSummaryAndAnnounce(env, projectId, roomId);
  } catch (err) {
    logError("automation.auto_room_summary_failed", err, { projectId, roomId });
  }
}

export async function generateRoomSummaryAndAnnounce(env, projectId, roomId) {
  if (!workerSharedLlmAllowed(env, projectId)) {
    return;
  }
  const { isAiConfigured } = await import("./ai-gateway.js");
  const { chatCompletion } = await import("./ai-chat-completion.js");
  if (!isAiConfigured(env)) {
    return;
  }

  const rows = await env.DB.prepare(
    "SELECT user_id, content, created_at FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
  )
    .bind(projectId, roomId)
    .all();

  const messages = (rows.results || []).reverse();
  if (!messages.length) return;

  const transcript = messages
    .map(
      (m) =>
        `[${m.created_at}] ${m.user_id}: ${m.content}`.replace(/\s+/g, " ")
    )
    .join("\n");

  const systemPrompt =
    "You are a concise system assistant for a developer chat product called fluxychat. Summarize the recent conversation in 2–4 bullet points and optionally suggest one helpful follow-up action.";

  const ai = await chatCompletion(env, {
    model: env.AI_MODEL || "openai/gpt-4o-mini",
    maxTokens: 256,
    temperature: 0.3,
    logContext: { projectId, roomId, feature: "room_summary" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Here is the recent transcript for room "${roomId}":\n\n${transcript}`,
      },
    ],
  });

  if (!ai.ok) {
    console.error("AI API error", ai.error);
    return;
  }

  const content = ai.content || "System summary unavailable due to an AI provider issue.";

  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      id: Date.now(),
      content,
      userId: "fluxychat-bot",
    }),
  });
}

/**
 * P15-E: Maybe extract room memory via AI.
 * Runs every ROOM_MEMORY_EVERY_N messages (default 20) when AI is configured.
 */
async function maybeExtractRoomMemory(env, detail) {
  try {
    if (env.ROOM_MEMORY_ENABLED !== "true" && env.ROOM_MEMORY_ENABLED !== "1") {
      return;
    }
    if (!workerSharedLlmAllowed(env, detail.projectId)) {
      return;
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL`
    )
      .bind(detail.projectId, detail.roomId)
      .first();

    const messageCount = countRow?.cnt || 0;
    const everyN = Number(env.ROOM_MEMORY_EVERY_N) || 20;
    if (messageCount === 0 || messageCount % everyN !== 0) {
      return;
    }

    const { extractRoomMemory, persistRoomMemory } = await import("./room-memory.js");

    const extracted = await extractRoomMemory(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
    });

    if (!extracted.ok || !extracted.entries.length) {
      return;
    }

    await persistRoomMemory(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      entries: extracted.entries,
    });
  } catch (err) {
    logError("room_memory.extraction_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
    });
  }
}

/**
 * P15-F: Maybe generate and store a message embedding for semantic search.
 * Runs for every message when SEMANTIC_SEARCH_ENABLED=true and AI is configured.
 */
async function maybeStoreMessageEmbedding(env, detail) {
  try {
    if (env.SEMANTIC_SEARCH_ENABLED !== "true" && env.SEMANTIC_SEARCH_ENABLED !== "1") {
      return;
    }
    if (!workerSharedLlmAllowed(env, detail.projectId)) {
      return;
    }
    if (!detail.content || detail.content.length < 10) {
      return;
    }
    if (!detail.messageId) {
      return;
    }

    const { storeMessageEmbedding } = await import("./message-embeddings.js");
    await storeMessageEmbedding(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      messageId: Number(detail.messageId),
      content: detail.content,
    });
  } catch (err) {
    logError("semantic_search.embedding_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      messageId: detail.messageId,
    });
  }
}

/**
 * P16-B: Maybe extract knowledge graph entities and relations from room.
 * Runs every KNOWLEDGE_GRAPH_EVERY_N messages (default 30) when KG is enabled.
 * Incremental extraction — only processes recent messages since last extraction.
 */
async function maybeExtractKnowledgeGraph(env, detail) {
  try {
    if (env.KNOWLEDGE_GRAPH_ENABLED !== "true" && env.KNOWLEDGE_GRAPH_ENABLED !== "1") {
      return;
    }
    if (!workerSharedLlmAllowed(env, detail.projectId)) {
      return;
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL`
    )
      .bind(detail.projectId, detail.roomId)
      .first();

    const messageCount = countRow?.cnt || 0;
    const everyN = Number(env.KNOWLEDGE_GRAPH_EVERY_N) || 30;
    if (messageCount === 0 || messageCount % everyN !== 0) {
      return;
    }

    const lastEvent = await env.DB.prepare(
      `SELECT created_at FROM automation_events
       WHERE project_id = ? AND room_id = ? AND event_type = 'knowledge_graph_extract'
       ORDER BY id DESC LIMIT 1`
    )
      .bind(detail.projectId, detail.roomId)
      .first();

    const since = lastEvent?.created_at || null;

    const { extractKnowledgeGraph, persistKnowledgeGraph } = await import("./knowledge-graph.js");

    const extracted = await extractKnowledgeGraph(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      since,
    });

    if (!extracted.ok || (!extracted.nodes.length && !extracted.edges.length)) {
      return;
    }

    await persistKnowledgeGraph(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      nodes: extracted.nodes,
      edges: extracted.edges,
    });

    const now = new Date().toISOString();
    // Audit B-2: idempotency key dedups re-enqueues.
    const idempotencyKey = `knowledge_graph_extract:${detail.projectId}:${detail.roomId}:${now}`;
    await env.DB.prepare(
      `INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, idempotency_key) DO NOTHING`
    )
      .bind(
        detail.projectId,
        "knowledge_graph_extract",
        detail.roomId,
        JSON.stringify({
          nodesExtracted: extracted.nodes.length,
          edgesExtracted: extracted.edges.length,
          since,
        }),
        now,
        idempotencyKey,
      )
      .run();
  } catch (err) {
    logError("knowledge_graph.extraction_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
    });
  }
}

/**
 * P16-E: Maybe run AI semantic moderation scan on message content.
 * LLM-based toxicity, spam, PII, and harassment detection.
 * Gated by AI_MODERATION_ENABLED=true + workerSharedLlmAllowed.
 */
async function maybeRunAiModerationScan(env, detail) {
  try {
    if (env.AI_MODERATION_ENABLED !== "true" && env.AI_MODERATION_ENABLED !== "1") {
      return;
    }
    if (!workerSharedLlmAllowed(env, detail.projectId)) {
      return;
    }
    if (!detail.content || String(detail.content).trim().length < 5) {
      return;
    }

    const { analyzeContent, queueModerationEvent, applyAutoAction } = await import("./ai-moderation.js");

    const analysis = await analyzeContent(env, {
      content: detail.content,
      projectId: detail.projectId,
      roomId: detail.roomId,
      userId: detail.authorUserId,
      messageId: detail.messageId ? Number(detail.messageId) : undefined,
    });

    if (!analysis.ok || analysis.severity === "none") {
      return;
    }

    let autoActionTaken = null;
    if (analysis.severity !== "none") {
      const autoResult = await applyAutoAction(env, {
        projectId: detail.projectId,
        roomId: detail.roomId,
        userId: detail.authorUserId,
        severity: analysis.severity,
        suggestedAction: analysis.suggestedAction,
        messageId: detail.messageId ? Number(detail.messageId) : undefined,
      });
      autoActionTaken = autoResult.applied;
    }

    await queueModerationEvent(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      userId: detail.authorUserId,
      messageId: detail.messageId ? Number(detail.messageId) : undefined,
      content: detail.content,
      severity: analysis.severity,
      categories: analysis.categories,
      reason: analysis.reason,
      confidence: analysis.confidence,
      suggestedAction: analysis.suggestedAction,
      autoActionTaken,
    });
  } catch (err) {
    logError("ai_moderation.scan_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      messageId: detail.messageId,
    });
  }
}

