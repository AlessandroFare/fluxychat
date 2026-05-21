import { callLlmOpenAIStream } from "./llm-stream.js";
import {
  formatModelRef,
  isAnthropicConnection,
  normalizeAgentLlmFields,
  resolveLlmConnectionWithFallback,
} from "./llm-providers.js";
import { createAgentStreamHooks, roomStreamOp } from "./room-stream.js";
import { isPrivateUrl } from "./url-ssrf.js";
import { logInfo, logError } from "./worker-log.js";
import {
  MAX_TOOL_ITERATIONS,
  callLlmForConnection,
  extractLlmResponse,
  buildToolResultMessage,
  estimateCost,
} from "./agent-llm.js";
import { executeToolCall, fetchAppContext } from "./agent-tools.js";
import { safeJsonParse, truncateForStorage } from "./storage-utils.js";
import {
  MAX_MESSAGE_LENGTH,
  validateMessageContent,
} from "./message-validation.js";
import { schedulePostMessageAutomations } from "./post-message-automations.js";

/** Best-effort realtime tool/run events for connected room clients. */
async function announceRoomEvent(env, roomId, payload) {
  try {
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

export function mapBotRowToAgent(row) {
  const provider = row.provider || null;
  const model = row.model || null;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    handle: row.handle || null,
    provider,
    model,
    modelRef: provider && model ? formatModelRef(provider, model) : null,
    capabilities: row.capabilities
      ? String(row.capabilities)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    config: row.config ? safeJsonParse(row.config) : null,
    systemPrompt: row.system_prompt || null,
    contextFetchUrl: row.context_fetch_url || null,
    toolExecuteUrl: row.tool_execute_url || null,
    toolsSchema: row.tools_schema ? safeJsonParse(row.tools_schema) : null,
    rateLimitRpm: row.rate_limit_rpm || null,
    createdAt: row.created_at,
  };
}

export async function upsertAgentFromBody(env, projectId, body) {
  if (body.contextFetchUrl && isPrivateUrl(body.contextFetchUrl)) {
    throw new Error("contextFetchUrl must not target private/internal networks");
  }
  if (body.toolExecuteUrl && isPrivateUrl(body.toolExecuteUrl)) {
    throw new Error("toolExecuteUrl must not target private/internal networks");
  }
  const llmBaseUrl = body.config?.llm?.baseUrl;
  if (llmBaseUrl && isPrivateUrl(llmBaseUrl)) {
    throw new Error("config.llm.baseUrl must not target private/internal networks");
  }
  const now = new Date().toISOString();
  const agentId = body.id || crypto.randomUUID();
  const llmFields = normalizeAgentLlmFields(body.provider, body.model);
  await env.DB.prepare(
    "INSERT OR REPLACE INTO bots (id, project_id, name, webhook_url, handle, provider, model, capabilities, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM bots WHERE id = ?), ?))"
  )
    .bind(
      agentId,
      projectId,
      body.name,
      body.webhookUrl || null,
      body.handle || null,
      llmFields.provider,
      llmFields.model,
      Array.isArray(body.capabilities)
        ? body.capabilities.join(",")
        : body.capabilities || null,
      body.config ? JSON.stringify(body.config) : null,
      body.systemPrompt || null,
      body.contextFetchUrl || null,
      body.toolExecuteUrl || null,
      body.toolsSchema ? JSON.stringify(body.toolsSchema) : null,
      body.rateLimitRpm || null,
      agentId,
      now
    )
    .run();
  return {
    id: agentId,
    projectId,
    name: body.name,
    handle: body.handle || null,
    provider: llmFields.provider,
    model: llmFields.model,
    modelRef: llmFields.modelRef,
    capabilities: Array.isArray(body.capabilities)
      ? body.capabilities
      : body.capabilities
      ? String(body.capabilities)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    config: body.config || null,
    systemPrompt: body.systemPrompt || null,
    contextFetchUrl: body.contextFetchUrl || null,
    toolExecuteUrl: body.toolExecuteUrl || null,
    toolsSchema: body.toolsSchema || null,
    rateLimitRpm: body.rateLimitRpm || null,
    createdAt: now,
  };
}

/** Normalize @handle / handle for mention lookups (DB may store either form). */
export function normalizeMentionHandle(handle) {
  return String(handle || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
}

export async function invokeMentionedAgents(
  env,
  projectId,
  roomId,
  userId,
  content,
  mentions,
  traceId,
  parentId = null,
) {
  const resolvedParentId =
    parentId != null && Number.isFinite(Number(parentId))
      ? Math.floor(Number(parentId))
      : null;
  const agentHandles = mentions.map((m) => (m.startsWith("@") ? m.slice(1) : m));
  if (!agentHandles.length) return;

  const normalized = [
    ...new Set(agentHandles.map((h) => normalizeMentionHandle(h)).filter(Boolean)),
  ];
  if (!normalized.length) return;

  const placeholders = normalized.map(() => "?").join(",");
  const agentRows = await env.DB.prepare(
    `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm FROM bots WHERE project_id = ? AND LOWER(REPLACE(handle, '@', '')) IN (${placeholders})`
  )
    .bind(projectId, ...normalized)
    .all();

  for (const agentRow of agentRows.results || []) {
    try {
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      await stub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "agentTyping",
          agentId: agentRow.id,
          isTyping: true,
        }),
      }).catch(() => {});

      const streamHooks = createAgentStreamHooks(env, {
        projectId,
        roomId,
        userId: agentRow.id,
        parentId: resolvedParentId,
      });

      const result = await executeAgentRun(env, {
        agentRow,
        projectId,
        roomId,
        userMessage: content,
        userId,
        traceId,
        streamHooks,
      });

      if (result.status === "completed" && result.content) {
        const createdAt = new Date().toISOString();
        const contentValidation = validateMessageContent(result.content);
        const agentContent = contentValidation.valid ? contentValidation.content : result.content.slice(0, MAX_MESSAGE_LENGTH);
        let mentionMessageId = streamHooks.getMessageId();

        if (!mentionMessageId) {
          const agentMsgInsert = await env.DB.prepare(
            "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(
              projectId,
              roomId,
              agentRow.id,
              agentContent,
              createdAt,
              resolvedParentId,
              null,
              null,
              null,
              null,
              null,
            )
            .run();
          mentionMessageId = agentMsgInsert.meta.last_row_id;

          const id = env.ROOM.idFromName(roomId);
          const stub = env.ROOM.get(id);
          await stub.fetch("https://internal/announce", {
            method: "POST",
            body: JSON.stringify({
              id: mentionMessageId,
              content: agentContent,
              userId: agentRow.id,
              parentId: resolvedParentId,
            }),
          }).catch(() => {});

          await schedulePostMessageAutomations(env, {
            projectId,
            roomId,
            authorUserId: agentRow.id,
            messageId: mentionMessageId,
            content: agentContent,
            traceId,
          });
        }

        await env.DB.prepare(
          "INSERT INTO agent_runs (id, project_id, agent_id, room_id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, tool_calls_json, context_fetched, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(
            result.runId, projectId, agentRow.id, roomId, "completed",
            result.latencyMs, result.inputTokens, result.outputTokens, result.estimatedCost,
            null,
            result.toolCalls.length ? JSON.stringify(result.toolCalls) : null,
            result.contextFetched, result.iterations, createdAt
          )
          .run();

        logInfo("agent.mention_invoke_completed", { projectId, agentId: agentRow.id, roomId, runId: result.runId, streamed: true });
      }

      await stub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "agentTyping",
          agentId: agentRow.id,
          isTyping: false,
        }),
      }).catch(() => {});
    } catch (err) {
      logError("agent.mention_invoke_error", err, { projectId, agentId: agentRow.id, roomId });
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      await stub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "agentTyping",
          agentId: agentRow.id,
          isTyping: false,
        }),
      }).catch(() => {});
    }
  }
}

export async function executeAgentRun(env, { agentRow, projectId, roomId, userMessage, userId, traceId, streamHooks }) {
  const startTime = performance.now();
  const runId = crypto.randomUUID();
  const agentConfig = agentRow.config
    ? typeof agentRow.config === "string"
      ? safeJsonParse(agentRow.config)
      : agentRow.config
    : null;
  const { primary: primaryResolved, fallback: fallbackResolved } = await resolveLlmConnectionWithFallback(env, {
    provider: agentRow.provider || null,
    model: agentRow.model || null,
    config: agentConfig,
    projectId,
  });
  if (!primaryResolved.ok) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorText = primaryResolved.error || "llm_provider_not_configured";
    await announceRoomEvent(env, roomId, {
      type: "agentRun",
      run: {
        id: runId,
        status: "failed",
        latency_ms: latencyMs,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost: 0,
        room_id: roomId,
        tool_calls: [],
        iterations: 0,
        error: errorText,
        created_at: new Date().toISOString(),
      },
    });
    return {
      runId,
      status: "failed",
      content: null,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      toolCalls: [],
      contextFetched: 0,
      iterations: 0,
      error: errorText,
    };
  }
  let connection = primaryResolved;
  const hasFallback = !!(fallbackResolved && fallbackResolved.ok);
  const systemPrompt = agentRow.system_prompt || "You are a helpful assistant in a chat room.";
  const toolsSchemaRaw = agentRow.tools_schema;
  const contextFetchUrl = agentRow.context_fetch_url;
  const toolExecuteUrl = agentRow.tool_execute_url;
  const toolsSchema = toolsSchemaRaw ? safeJsonParse(toolsSchemaRaw) : null;
  const tools = Array.isArray(toolsSchema) && toolsSchema.length > 0 ? toolsSchema : null;

  const allToolCalls = [];
  let contextFetched = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;
  let lastContent = null;

  try {
    const contextRows = await env.DB.prepare(
      "SELECT user_id, content, created_at FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30"
    ).bind(projectId, roomId).all();
    const conversationHistory = (contextRows.results || []).reverse();

    const messages = [{ role: "system", content: systemPrompt }];

    let appContext = null;
    if (contextFetchUrl) {
      appContext = await fetchAppContext(env, contextFetchUrl, projectId, roomId, userId, traceId);
      if (appContext) {
        contextFetched = 1;
        messages.push({ role: "system", content: `[App Context]\n${JSON.stringify(appContext).slice(0, 4000)}` });
      }
    }

    for (const msg of conversationHistory) {
      messages.push({ role: msg.user_id === userId ? "user" : "assistant", content: `[${msg.user_id}]: ${msg.content}` });
    }
    messages.push({ role: "user", content: userMessage });

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      iterations++;
      const canStreamFinal =
        streamHooks && !tools && connection.supportsStreaming;

      if (canStreamFinal) {
        try {
          await streamHooks.onStart("");
          const { content, usage } = await callLlmOpenAIStream(
            connection.baseUrl,
            connection.apiKey,
            connection.model,
            messages,
            { maxTokens: 1024, temperature: 0.7 },
            async (delta, fullContent) => {
              await streamHooks.onDelta(delta, fullContent);
            }
          );
          await streamHooks.onEnd(content);
          lastContent = content;
          totalInputTokens += usage.prompt_tokens || 0;
          totalOutputTokens += usage.completion_tokens || 0;
          break;
        } catch (streamErr) {
          if (streamHooks.getMessageId()) {
            await roomStreamOp(env, roomId, {
              projectId,
              userId: agentRow.id,
              op: "abort",
            }).catch(() => {});
          }
          if (hasFallback && i === 0 && fallbackResolved?.ok) {
            logInfo("agent.stream_fallback", {
              projectId,
              agentId: agentRow.id,
              from: connection.providerId,
              to: fallbackResolved.providerId,
              error: streamErr.message,
            });
            connection = fallbackResolved;
            if (connection.supportsStreaming) {
              continue;
            }
          } else {
            throw streamErr;
          }
        }
      }

      let response;
      try {
        response = await callLlmForConnection(connection, messages, tools, systemPrompt, { maxTokens: 1024, temperature: 0.7 });
      } catch (primaryErr) {
        if (hasFallback && i === 0 && fallbackResolved?.ok) {
          logInfo("agent.provider_fallback", {
            projectId,
            agentId: agentRow.id,
            from: connection.providerId,
            to: fallbackResolved.providerId,
            error: primaryErr.message,
          });
          connection = fallbackResolved;
          try {
            response = await callLlmForConnection(connection, messages, tools, systemPrompt, { maxTokens: 1024, temperature: 0.7 });
          } catch (fallbackErr) {
            return { runId, status: "failed", content: null, latencyMs: performance.now() - startTime, inputTokens: 0, outputTokens: 0, estimatedCost: 0, toolCalls: allToolCalls, contextFetched, iterations, error: `primary: ${primaryErr.message}; fallback: ${fallbackErr.message}` };
          }
        } else {
          throw primaryErr;
        }
      }
      const extracted = extractLlmResponse(connection, response, tools, runId);
      lastContent = extracted.content;

      if (isAnthropicConnection(connection)) {
        totalInputTokens += response.usage?.input_tokens || 0;
        totalOutputTokens += response.usage?.output_tokens || 0;
      } else {
        totalInputTokens += response.usage?.prompt_tokens || 0;
        totalOutputTokens += response.usage?.completion_tokens || 0;
      }

      const hasToolCalls = extracted.toolCalls && extracted.toolCalls.length > 0;
      const shouldStop = !hasToolCalls
        || (isAnthropicConnection(connection) && extracted.stopReason === "end_turn")
        || (!isAnthropicConnection(connection) && extracted.finishReason === "stop");

      if (!hasToolCalls || shouldStop) break;

      if (!toolExecuteUrl) break;

      if (isAnthropicConnection(connection)) {
        const assistantContent = [];
        if (extracted.content) assistantContent.push({ type: "text", text: extracted.content });
        for (const tc of extracted.toolCalls) {
          let input = {};
          try { input = JSON.parse(tc.arguments); } catch { input = {}; }
          assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input });
        }
        messages.push({ role: "assistant", content: assistantContent });
      } else {
        messages.push({
          role: "assistant",
          content: extracted.content || null,
          tool_calls: extracted.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      }

      for (const tc of extracted.toolCalls) {
        await announceRoomEvent(env, roomId, {
          type: "tool_call",
          runId,
          agentId: agentRow.id,
          toolCallId: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        });
        const toolResult = await executeToolCall(env, toolExecuteUrl, tc, projectId, runId, traceId);
        await announceRoomEvent(env, roomId, {
          type: toolResult.success ? "tool_result" : "tool_error",
          runId,
          agentId: agentRow.id,
          toolCallId: tc.id,
          name: tc.name,
          result: toolResult.success ? toolResult.result : undefined,
          error: toolResult.success ? undefined : toolResult.error || "tool_failed",
        });
        allToolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          success: toolResult.success,
          result: toolResult.success ? toolResult.result : undefined,
          error: toolResult.success ? undefined : toolResult.error,
        });
        const resultMsg = buildToolResultMessage(connection, tc, toolResult);
        messages.push(resultMsg);
        if (!toolResult.success) break;
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const finalContent = lastContent || "I was unable to generate a response.";

    await announceRoomEvent(env, roomId, {
      type: "agentRun",
      run: {
        id: runId,
        status: "completed",
        latency_ms: latencyMs,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        estimated_cost: estimateCost(
          connection.providerId,
          connection.model,
          totalInputTokens,
          totalOutputTokens,
        ),
        room_id: roomId,
        tool_calls: allToolCalls,
        iterations,
        created_at: new Date().toISOString(),
      },
    });

    return {
      runId,
      status: "completed",
      content: finalContent,
      latencyMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCost: estimateCost(connection.providerId, connection.model, totalInputTokens, totalOutputTokens),
      toolCalls: allToolCalls,
      contextFetched,
      iterations,
      error: null,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorText = truncateForStorage(err instanceof Error ? err.message : "agent_run_failed");
    await announceRoomEvent(env, roomId, {
      type: "agentRun",
      run: {
        id: runId,
        status: "failed",
        latency_ms: latencyMs,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        estimated_cost: 0,
        room_id: roomId,
        tool_calls: allToolCalls,
        iterations,
        error: errorText,
        created_at: new Date().toISOString(),
      },
    });
    return {
      runId,
      status: "failed",
      content: null,
      latencyMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCost: 0,
      toolCalls: allToolCalls,
      contextFetched,
      iterations,
      error: errorText,
    };
  }
}
