/**
 * Bots and agents CRUD, invoke, runs, bot messages
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchAgentsRoutes(request, url, h) {
  const {
    env,
    ctx,
    traceId,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    logInfo,
    projectId,
    MAX_MESSAGE_LENGTH,
    checkAndConsumeProjectQuota,
    quotaResetInfo,
    checkAndConsumeRateLimit,
    incrementOperationalMetric,
    validateMessageContent,
    isValidId,
    isValidHandle,
    extractMentions,
    extractFirstUrl,
    fetchOgPreview,
    schedulePostMessageAutomations,
    upsertAgentFromBody,
    mapBotRowToAgent,
    executeAgentRun,
    createAgentStreamHooks,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "traceId",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "logInfo",
    "projectId",
    "MAX_MESSAGE_LENGTH",
    "checkAndConsumeProjectQuota",
    "quotaResetInfo",
    "checkAndConsumeRateLimit",
    "incrementOperationalMetric",
    "validateMessageContent",
    "isValidId",
    "isValidHandle",
    "extractMentions",
    "extractFirstUrl",
    "fetchOgPreview",
    "schedulePostMessageAutomations",
    "upsertAgentFromBody",
    "mapBotRowToAgent",
    "executeAgentRun",
    "createAgentStreamHooks",
    "writeAuditEvent",
  ]);

  // Create or update bot/agent: POST /bots
  if (url.pathname === "/bots" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }
    const { projectId: authProjectId } = auth;
    const body = await request.json().catch(() => null);
    if (!body || !body.name) {
      return json({ error: "name required" }, { status: 400 });
    }
    let result;
    try {
      result = await upsertAgentFromBody(env, authProjectId, body);
    } catch (err) {
      return json({ error: err.message }, { status: 400 });
    }
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: authProjectId,
        action: "agent.create",
        actorUserId: auth.userId,
        targetType: "agent",
        targetId: result.id,
        traceId,
        metadata: { name: body.name, handle: body.handle },
      }).catch(() => {})
    );
    return json({ bot: result });
  }
  if (url.pathname === "/agents" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const quotaResult = await checkAndConsumeProjectQuota(env, {
      projectId: auth.projectId,
      metricName: "agent_invokes",
      amount: 1,
    }).catch(() => ({ allowed: true }));
    if (!quotaResult.allowed) {
      return json(
        {
          error: "quota_exceeded",
          metric: quotaResult.metricName,
          limit: quotaResult.limit,
          used: quotaResult.used,
          month: quotaResult.monthKey,
        },
        { status: 402 }
      );
    }
    const rows = await env.DB.prepare(
      "SELECT id, project_id, name, handle, provider, model, capabilities, config, created_at FROM bots WHERE project_id = ? ORDER BY created_at DESC LIMIT 100" // perf: unbounded
    )
      .bind(auth.projectId)
      .all();
    return json({
      agents: (rows.results || []).map(mapBotRowToAgent),
    });
  }

  if (url.pathname === "/agents" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    if (!body?.name || !isValidId(body.name)) {
      return json(
        { error: "name required: must be 1-128 chars, alphanumeric with _ -" },
        { status: 400 }
      );
    }
    if (body.handle && !isValidHandle(body.handle)) {
      return json(
        { error: "handle must be 1-64 chars, alphanumeric with _ -" },
        { status: 400 }
      );
    }
    let result;
    try {
      result = await upsertAgentFromBody(env, auth.projectId, body);
    } catch (err) {
      return json({ error: err.message }, { status: 400 });
    }
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "agent.create",
        actorUserId: auth.userId,
        targetType: "agent",
        targetId: result.id,
        traceId,
        metadata: { name: body.name, handle: body.handle, provider: body.provider },
      }).catch(() => {})
    );
    return json({ agent: result });
  }

  if (
    url.pathname.startsWith("/agents/") &&
    !url.pathname.endsWith("/invoke") &&
    !url.pathname.endsWith("/runs") &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const agentId = url.pathname.split("/")[2];
    const body = await request.json().catch(() => null);
    if (!agentId || !body) {
      return json({ error: "agent id and body required" }, { status: 400 });
    }
    const existing = await env.DB.prepare(
      "SELECT id FROM bots WHERE id = ? AND project_id = ?"
    )
      .bind(agentId, auth.projectId)
      .first();
    if (!existing) return json({ error: "agent not found" }, { status: 404 });
    let result;
    try {
      result = await upsertAgentFromBody(env, auth.projectId, { ...body, id: agentId });
    } catch (err) {
      return json({ error: err.message }, { status: 400 });
    }
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "agent.update",
        actorUserId: auth.userId,
        targetType: "agent",
        targetId: agentId,
        traceId,
        metadata: { name: body.name },
      }).catch(() => {})
    );
    return json({ agent: result });
  }

  if (
    url.pathname.startsWith("/agents/") &&
    !url.pathname.endsWith("/invoke") &&
    !url.pathname.endsWith("/runs") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const agentId = url.pathname.split("/")[2];
    if (!agentId) return json({ error: "agent id required" }, { status: 400 });
    const row = await env.DB.prepare(
      "SELECT id, project_id, name, handle, provider, model, capabilities, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, created_at FROM bots WHERE id = ? AND project_id = ?"
    )
      .bind(agentId, auth.projectId)
      .first();
    if (!row) return json({ error: "agent not found" }, { status: 404 });
    return json({ agent: mapBotRowToAgent(row) });
  }

  if (
    url.pathname.startsWith("/agents/") &&
    !url.pathname.endsWith("/invoke") &&
    !url.pathname.endsWith("/runs") &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const agentId = url.pathname.split("/")[2];
    if (!agentId) return json({ error: "agent id required" }, { status: 400 });
    const existing = await env.DB.prepare(
      "SELECT id FROM bots WHERE id = ? AND project_id = ?"
    )
      .bind(agentId, auth.projectId)
      .first();
    if (!existing) return json({ error: "agent not found" }, { status: 404 });
    await env.DB.prepare("DELETE FROM bots WHERE id = ? AND project_id = ?")
      .bind(agentId, auth.projectId)
      .run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "agent.delete",
        actorUserId: auth.userId,
        targetType: "agent",
        targetId: agentId,
        traceId,
        metadata: {},
      }).catch(() => {})
    );
    return json({ ok: true });
  }

  if (
    url.pathname.startsWith("/agents/") &&
    url.pathname.endsWith("/invoke") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const parts = url.pathname.split("/");
    const agentId = parts[2];
    const body = await request.json().catch(() => null);
    if (!agentId || !body?.roomId || !body?.content) {
      return json({ error: "agentId, roomId and content required" }, { status: 400 });
    }
    const contentValidation = validateMessageContent(body.content);
    if (!contentValidation.valid) {
      return json({ error: contentValidation.error }, { status: 400 });
    }

    const agentRow = await env.DB.prepare(
      "SELECT id, name, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm FROM bots WHERE id = ? AND project_id = ?"
    )
      .bind(agentId, auth.projectId)
      .first();
    if (!agentRow) {
      const createdAt = new Date().toISOString();
      const runId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO agent_runs (id, project_id, agent_id, room_id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(runId, auth.projectId, agentId, body.roomId, "failed", 0, 0, 0, 0, "agent_not_found", createdAt)
        .run();
      await incrementOperationalMetric(env, { metricName: "agent_runs_failed", projectId: auth.projectId, value: 1 }).catch(() => {});
      return json({ error: "agent not found" }, { status: 404 });
    }

    const agentRateLimit = await checkAndConsumeRateLimit(env, {
      key: `agent:${auth.projectId}:${agentId}`,
      limit: Number(agentRow.rate_limit_rpm || 60),
      windowSeconds: 60,
    });
    if (!agentRateLimit.allowed) {
      return json({ error: "agent_rate_limit_exceeded", retryAfterSeconds: agentRateLimit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(agentRateLimit.retryAfterSeconds) } });
    }

    const quotaResult = await checkAndConsumeProjectQuota(env, {
      projectId: auth.projectId,
      metricName: "agent_invokes",
      amount: 1,
    }).catch(() => ({ allowed: true }));
    if (!quotaResult.allowed) {
      const reset = quotaResetInfo();
      return json(
        {
          error: "quota_exceeded",
          metric: quotaResult.metricName,
          limit: quotaResult.limit,
          used: quotaResult.used,
          month: quotaResult.monthKey,
          resetsAt: reset.resetsAt,
          retryAfterSeconds: reset.retryAfterSeconds,
        },
        { status: 402, headers: { "Retry-After": String(reset.retryAfterSeconds) } }
      );
    }

    const doId = env.ROOM.idFromName(body.roomId);
    const doStub = env.ROOM.get(doId);

    ctx.waitUntil(
      doStub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({ type: "agentTyping", agentId, isTyping: true }),
      }).catch(() => {})
    );

    const useStream = body.stream !== false;
    const streamHooks = useStream
      ? createAgentStreamHooks(env, {
          projectId: auth.projectId,
          roomId: body.roomId,
          userId: agentId,
          parentId: body.replyTo || null,
        })
      : null;

    const result = await executeAgentRun(env, {
      agentRow,
      projectId: auth.projectId,
      roomId: body.roomId,
      userMessage: contentValidation.content,
      userId: auth.userId,
      traceId,
      streamHooks,
    });

    ctx.waitUntil(
      doStub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({ type: "agentTyping", agentId, isTyping: false }),
      }).catch(() => {})
    );

    const createdAt = new Date().toISOString();

    if (result.status === "completed" && result.content) {
      const contentValidation2 = validateMessageContent(result.content);
      const agentContent = contentValidation2.valid ? contentValidation2.content : result.content.slice(0, MAX_MESSAGE_LENGTH);
      let messageId = streamHooks?.getMessageId() ?? null;

      if (!messageId) {
        const insert = await env.DB.prepare(
          "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(auth.projectId, body.roomId, agentId, agentContent, createdAt, body.replyTo || null, null, null, null, null, null)
          .run();
        messageId = insert.meta.last_row_id;

        const id = env.ROOM.idFromName(body.roomId);
        const stub = env.ROOM.get(id);
        ctx.waitUntil(
          stub.fetch("https://internal/announce", {
            method: "POST",
            body: JSON.stringify({ id: messageId, content: agentContent, userId: agentId }),
          }).catch((err) => logError("agent.announce_failed", err, requestLogCtx))
        );
      }

      await env.DB.prepare(
        "INSERT INTO agent_runs (id, project_id, agent_id, room_id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, tool_calls_json, context_fetched, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          result.runId, auth.projectId, agentId, body.roomId, "completed",
          result.latencyMs, result.inputTokens, result.outputTokens, result.estimatedCost,
          null,
          result.toolCalls.length ? JSON.stringify(result.toolCalls) : null,
          result.contextFetched, result.iterations, createdAt
        )
        .run();

      logInfo("agent.invoke_completed", { ...requestLogCtx, projectId: auth.projectId, agentId, roomId: body.roomId, runId: result.runId, latencyMs: result.latencyMs, iterations: result.iterations, toolCallsCount: result.toolCalls.length, streamed: !!streamHooks });

      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: auth.projectId,
          action: "agent.invoke",
          actorUserId: auth.userId,
          targetType: "agent",
          targetId: agentId,
          traceId,
          metadata: { runId: result.runId, roomId: body.roomId, status: "completed", latencyMs: result.latencyMs, iterations: result.iterations, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: result.estimatedCost, streamed: !!streamHooks },
        }).catch(() => {})
      );

      if (!streamHooks) {
        ctx.waitUntil(
          schedulePostMessageAutomations(env, {
            projectId: auth.projectId,
            roomId: body.roomId,
            authorUserId: agentId,
            messageId,
            content: agentContent,
            traceId,
          })
        );
      }

      return json({
        run: { id: result.runId, status: "completed", latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: result.estimatedCost, iterations: result.iterations, toolCalls: result.toolCalls, createdAt },
        message: { id: messageId, roomId: body.roomId, senderId: agentId, content: agentContent },
      });
    }

    await env.DB.prepare(
      "INSERT INTO agent_runs (id, project_id, agent_id, room_id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, tool_calls_json, context_fetched, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        result.runId, auth.projectId, agentId, body.roomId, "failed",
        result.latencyMs, result.inputTokens, result.outputTokens, 0,
        result.error,
        result.toolCalls.length ? JSON.stringify(result.toolCalls) : null,
        result.contextFetched, result.iterations, createdAt
      )
      .run();
    await incrementOperationalMetric(env, { metricName: "agent_runs_failed", projectId: auth.projectId, value: 1 }).catch(() => {});
    logError("agent.invoke_failed", new Error(result.error || "unknown"), { ...requestLogCtx, projectId: auth.projectId, agentId, roomId: body.roomId, runId: result.runId });
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "agent.invoke",
        actorUserId: auth.userId,
        targetType: "agent",
        targetId: agentId,
        traceId,
        metadata: { runId: result.runId, roomId: body.roomId, status: "failed", error: result.error },
      }).catch(() => {})
    );
    return json({ error: result.error || "agent invoke failed", runId: result.runId }, { status: 500 });
  }

  if (
    url.pathname.startsWith("/agents/") &&
    url.pathname.endsWith("/runs") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const agentId = url.pathname.split("/")[2];
    const limit = Number(url.searchParams.get("limit") || "50");
    const rows = await env.DB.prepare(
      "SELECT id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, room_id, tool_calls_json, context_fetched, iterations, created_at FROM agent_runs WHERE project_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT ?"
    )
      .bind(auth.projectId, agentId, limit)
      .all();
    const runs = (rows.results || []).map((row) => {
      let toolCalls = [];
      if (row.tool_calls_json) {
        try {
          toolCalls = JSON.parse(row.tool_calls_json);
        } catch {
          toolCalls = [];
        }
      }
      return {
        id: row.id,
        status: row.status,
        latency_ms: row.latency_ms,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        estimated_cost: row.estimated_cost,
        error: row.error,
        room_id: row.room_id,
        tool_calls: toolCalls,
        context_fetched: row.context_fetched,
        iterations: row.iterations,
        created_at: row.created_at,
      };
    });
    return json({ runs });
  }

  // Bot message injection: POST /rooms/:id/messages/from-bot
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/messages/from-bot") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }
    const { projectId: authProjectId } = auth;
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    const body = await request.json().catch(() => null);
    if (!body || !body.botId || !body.content) {
      return json({ error: "botId and content required" }, { status: 400 });
    }

    // Optional: validate bot exists for this project
    const botRow = await env.DB.prepare(
      "SELECT id FROM bots WHERE id = ? AND project_id = ?"
    )
      .bind(body.botId, authProjectId)
      .first();
    if (!botRow) {
      return json({ error: "bot not found" }, { status: 404 });
    }

    const createdAt = new Date().toISOString();
    const content = body.content;
    const parentId = body.replyTo || null;
    const mentions = extractMentions(content);
    const firstUrl = extractFirstUrl(content);
    let preview = null;
    if (firstUrl && env.OG_PREVIEW_ENABLED !== "false") {
      preview = await fetchOgPreview(firstUrl, env);
    }

    const resInsert = await env.DB.prepare(
      "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        authProjectId,
        roomId,
        body.botId,
        content,
        createdAt,
        parentId,
        mentions.length ? JSON.stringify(mentions) : null,
        preview?.title || null,
        preview?.description || null,
        preview?.imageUrl || null,
        preview?.url || null
      )
      .run();

    const messageId = resInsert.meta.last_row_id;

    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({
        id: messageId,
        content,
        userId: body.botId,
      }),
    });

    ctx.waitUntil(
      schedulePostMessageAutomations(env, {
        projectId: authProjectId,
        roomId,
        authorUserId: body.botId,
        messageId,
        content,
        traceId,
      })
    );

    return json({
      message: {
        id: messageId,
        roomId,
        senderId: body.botId,
        content,
        createdAt,
      },
    });
  }

  return null;
}
