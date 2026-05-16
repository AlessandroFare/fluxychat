/**
 * Split from worker fetch handler (original lines 1481-2090).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchRealtimeStatsRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    projectId,
    isRoomMember,
    canAccessRoom,
    attachAttachmentsToMessages,
    getProjectPlan,
    getDefaultQuotaLimit,
    monthKeyUtc,
    toMinuteBucketIso,
    evaluateOperationalAlerts,
    canCreateTenantProjects,
    tenantScopeForbidden,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "projectId",
    "isRoomMember",
    "canAccessRoom",
    "attachAttachmentsToMessages",
    "getProjectPlan",
    "getDefaultQuotaLimit",
    "monthKeyUtc",
    "toMinuteBucketIso",
    "evaluateOperationalAlerts",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
  ]);


  if (url.pathname.startsWith("/ws/room/")) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const roomId = url.pathname.split("/").pop();
    const wsAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!wsAuth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const isMember = await isRoomMember(env, wsAuth.projectId, roomId, wsAuth.userId);
    if (!isMember) {
      return json({ error: "forbidden: user is not a member of this room" }, { status: 403 });
    }

    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  }

  // SSE endpoint for rooms (HTTP fallback when WebSocket is unavailable)
  if (url.pathname.match(/^\/rooms\/[^/]+\/stream$/) && request.method === "GET") {
    const acceptHeader = request.headers.get("Accept") || "";
    if (!acceptHeader.includes("text/event-stream") && !acceptHeader.includes("*/*")) {
      return json({ error: "Accept: text/event-stream required" }, { status: 406 });
    }
    const roomId = url.pathname.split("/")[2];
    const sseAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!sseAuth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const isMember = await isRoomMember(env, sseAuth.projectId, roomId, sseAuth.userId);
    if (!isMember) {
      return json({ error: "forbidden: user is not a member of this room" }, { status: 403 });
    }
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  }

  // Simple HTTP API for listing messages in a room (paged)
  if (url.pathname === "/api/messages" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const roomId = url.searchParams.get("roomId");
    const limit = Number(url.searchParams.get("limit") || "50");
    const before = url.searchParams.get("before") || null;

    if (!roomId) {
      return json({ error: "roomId required" }, { status: 400 });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    let sql =
      "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions, og_title, og_description, og_image, og_url FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ";
    const params = [auth.projectId, roomId];

    if (before) {
      sql += "AND created_at < ? ";
      params.push(before);
    }

    sql += "ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const result = await env.DB.prepare(sql).bind(...params).all();
    const rows = result.results || [];
    const mapped = await attachAttachmentsToMessages(
      env,
      auth.projectId,
      roomId,
      rows
    );

    return json({ messages: mapped });
  }

  // Room stats: message volume & active users (simple version)
  if (
    url.pathname.startsWith("/stats/rooms/") &&
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
    const roomId = url.pathname.split("/").pop();
    const since = url.searchParams.get("since"); // ISO optional
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    let base =
      "SELECT COUNT(*) as messageCount, COUNT(DISTINCT user_id) as activeUsers FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL";
    const params = [auth.projectId, roomId];
    if (since) {
      base += " AND created_at >= ?";
      params.push(since);
    }

    const row = await env.DB.prepare(base).bind(...params).first();

    return json({
      roomId,
      messageCount: row?.messageCount ?? 0,
      activeUsers: row?.activeUsers ?? 0,
    });
  }

  if (url.pathname === "/stats/costs" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const costMessagesPerMillion = Number(env.COST_MESSAGES_PER_MILLION || 1);
    const costRequestsPerMillion = Number(env.COST_REQUESTS_PER_MILLION || 0.2);
    const costWebhookFailureUnit = Number(env.COST_WEBHOOK_FAILURE_UNIT || 0.0005);
    const costAgentFailedRunUnit = Number(env.COST_AGENT_FAILED_RUN_UNIT || 0.001);

    const messageRow = await env.DB.prepare(
      "SELECT COUNT(*) as totalMessages FROM messages WHERE project_id = ? AND deleted_at IS NULL"
    )
      .bind(auth.projectId)
      .first();
    const totalMessages = Number(messageRow?.totalMessages ?? 0);
    const plan = await getProjectPlan(env, auth.projectId);

    const metricsWindowMinutes = Math.max(
      5,
      Math.min(Number(url.searchParams.get("windowMinutes") || "1440"), 10_080)
    );
    const fromBucket = toMinuteBucketIso(
      new Date(Date.now() - metricsWindowMinutes * 60_000)
    );
    const metricsRows = await env.DB.prepare(
      "SELECT metric_name, COALESCE(SUM(metric_value),0) as total FROM operational_metrics WHERE project_id = ? AND bucket_minute >= ? GROUP BY metric_name"
    )
      .bind(auth.projectId, fromBucket)
      .all();
    const metricsTotals = {};
    for (const row of metricsRows.results || []) {
      metricsTotals[row.metric_name] = Number(row.total || 0);
    }
    const requestsTotal = Number(metricsTotals.requests_total || 0);
    const requestsError = Number(metricsTotals.requests_error || 0);
    const webhookFailed = Number(metricsTotals.webhook_delivery_failed || 0);
    const agentRunsFailed = Number(metricsTotals.agent_runs_failed || 0);

    const aiRow = await env.DB.prepare(
      "SELECT COUNT(*) as runs, COALESCE(SUM(estimated_cost),0) as estimatedCost FROM agent_runs WHERE project_id = ?"
    )
      .bind(auth.projectId)
      .first();
    const aiRuns = Number(aiRow?.runs || 0);
    const aiCost = Number(aiRow?.estimatedCost || 0);
    const monthKey = monthKeyUtc();
    const usageRows = await env.DB.prepare(
      "SELECT metric_name, used_value FROM project_usage_monthly WHERE project_id = ? AND month_key = ?"
    )
      .bind(auth.projectId, monthKey)
      .all();
    const usageByMetric = {};
    for (const row of usageRows.results || []) {
      usageByMetric[row.metric_name] = Number(row.used_value || 0);
    }

    const messageCost = (totalMessages / 1_000_000) * costMessagesPerMillion;
    const requestCost = (requestsTotal / 1_000_000) * costRequestsPerMillion;
    const webhookFailureCost = webhookFailed * costWebhookFailureUnit;
    const agentFailureCost = agentRunsFailed * costAgentFailedRunUnit;
    const estimatedTotalCost =
      messageCost + requestCost + webhookFailureCost + agentFailureCost + aiCost;

    const pricePerMillionMessages = Number(env.PRICE_PER_MILLION_MESSAGES || 1);
    const pricePerAgentInvoke = Number(env.PRICE_PER_AGENT_INVOKE || 0);
    const pricePerWebhookDelivery = Number(env.PRICE_PER_WEBHOOK_DELIVERY || 0);
    const minGrossMargin = Number(env.MIN_GROSS_MARGIN || 0.3);
    const projectedMonthlyRevenue =
      (totalMessages / 1_000_000) * pricePerMillionMessages +
      aiRuns * pricePerAgentInvoke +
      Math.max(0, requestsTotal - requestsError) * pricePerWebhookDelivery;
    const grossProfit = projectedMonthlyRevenue - estimatedTotalCost;
    const grossMargin =
      projectedMonthlyRevenue > 0 ? grossProfit / projectedMonthlyRevenue : 0;
    const recommendedMinPricePerMillion =
      costMessagesPerMillion > 0 && minGrossMargin < 1
        ? costMessagesPerMillion / Math.max(0.01, 1 - minGrossMargin)
        : null;
    const guardrails = [];
    if (projectedMonthlyRevenue > 0 && grossMargin < minGrossMargin) {
      guardrails.push({
        level: "warning",
        code: "margin_below_min",
        message: `Gross margin ${grossMargin.toFixed(3)} below MIN_GROSS_MARGIN ${minGrossMargin}.`,
      });
    }
    if (recommendedMinPricePerMillion && pricePerMillionMessages < recommendedMinPricePerMillion) {
      guardrails.push({
        level: "info",
        code: "price_per_million_below_recommended",
        message: `PRICE_PER_MILLION_MESSAGES ${pricePerMillionMessages} below recommended >= ${recommendedMinPricePerMillion.toFixed(2)} for margin ${minGrossMargin}.`,
      });
    }

    const projected = {
      for1kMessages: (costMessagesPerMillion / 1_000_000) * 1_000,
      for100kMessages: (costMessagesPerMillion / 1_000_000) * 100_000,
      for1MMessages: costMessagesPerMillion,
    };

    const errorRate = requestsTotal > 0 ? requestsError / requestsTotal : 0;

    return json({
      projectId: auth.projectId,
      windowMinutes: metricsWindowMinutes,
      totals: {
        totalMessages,
        requestsTotal,
        requestsError,
        errorRate,
        webhookFailed,
        agentRunsFailed,
        aiRuns,
      },
      costBreakdown: {
        messageCost,
        requestCost,
        webhookFailureCost,
        agentFailureCost,
        aiCost,
        estimatedTotalCost,
      },
      pricing: {
        projectedMonthlyRevenue,
        grossProfit,
        grossMargin,
        minGrossMargin,
        pricePerMillionMessages,
        pricePerAgentInvoke,
        pricePerWebhookDelivery,
        recommendedMinPricePerMillionMessages: recommendedMinPricePerMillion,
        guardrails,
      },
      plan: plan || {
        projectId: auth.projectId,
        planName: "free",
        billingStatus: "manual",
        messageLimitMonthly: getDefaultQuotaLimit(env, "messages_created"),
        agentInvokeLimitMonthly: getDefaultQuotaLimit(env, "agent_invokes"),
        webhookDeliveryLimitMonthly: getDefaultQuotaLimit(env, "webhook_deliveries"),
        pricingVersion: env.DEFAULT_PRICING_VERSION || "v1",
      },
      usage: {
        monthKey,
        messagesCreated: Number(usageByMetric.messages_created || 0),
        agentInvokes: Number(usageByMetric.agent_invokes || 0),
        webhookDeliveries: Number(usageByMetric.webhook_deliveries || 0),
      },
      projected,
      assumptions: {
        costMessagesPerMillion,
        costRequestsPerMillion,
        costWebhookFailureUnit,
        costAgentFailedRunUnit,
      },
      note: "Estimated values from D1 counters and operational minute buckets; tune unit assumptions through env vars.",
    });
  }

  if (url.pathname === "/stats/launch-kpis" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      projectRow,
      apiKeyRow,
      secretRow,
      roomCountRow,
      messageCountRow,
      agentRunsRow,
      activeDaysLast7Row,
      activeDaysPrev7Row,
      monthlyUsageRow,
      monthlyAgentInvokesRow,
    ] = await Promise.all([
      env.DB.prepare("SELECT id FROM projects WHERE id = ? LIMIT 1")
        .bind(auth.projectId)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM api_keys WHERE project_id = ? AND revoked_at IS NULL"
      )
        .bind(auth.projectId)
        .first(),
      env.DB.prepare("SELECT project_id FROM project_secrets WHERE project_id = ? LIMIT 1")
        .bind(auth.projectId)
        .first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM rooms WHERE project_id = ?")
        .bind(auth.projectId)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND deleted_at IS NULL"
      )
        .bind(auth.projectId)
        .first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM agent_runs WHERE project_id = ?")
        .bind(auth.projectId)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(DISTINCT substr(created_at,1,10)) as c FROM messages WHERE project_id = ? AND created_at >= ? AND deleted_at IS NULL"
      )
        .bind(auth.projectId, sevenDaysAgo)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(DISTINCT substr(created_at,1,10)) as c FROM messages WHERE project_id = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL"
      )
        .bind(auth.projectId, fourteenDaysAgo, sevenDaysAgo)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND created_at >= ? AND deleted_at IS NULL"
      )
        .bind(auth.projectId, monthStartIso)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM agent_runs WHERE project_id = ? AND created_at >= ?"
      )
        .bind(auth.projectId, monthStartIso)
        .first(),
    ]);

    const onboardingChecks = {
      projectCreated: !!projectRow?.id,
      apiKeyActive: Number(apiKeyRow?.c || 0) > 0,
      jwtSecretConfigured: !!secretRow?.project_id,
      firstRoomCreated: Number(roomCountRow?.c || 0) > 0,
      firstMessageSent: Number(messageCountRow?.c || 0) > 0,
      firstAgentInvoke: Number(agentRunsRow?.c || 0) > 0,
    };
    const totalOnboardingSteps = Object.keys(onboardingChecks).length;
    const completedOnboardingSteps = Object.values(onboardingChecks).filter(Boolean).length;
    const activationRate =
      totalOnboardingSteps > 0 ? completedOnboardingSteps / totalOnboardingSteps : 0;

    const activeDaysLast7 = Number(activeDaysLast7Row?.c || 0);
    const activeDaysPrev7 = Number(activeDaysPrev7Row?.c || 0);
    const retainedDevelopers = activeDaysLast7 > 0 && activeDaysPrev7 > 0 ? 1 : 0;

    const monthlyMessages = Number(monthlyUsageRow?.c || 0);
    const monthlyAgentInvokes = Number(monthlyAgentInvokesRow?.c || 0);
    const freeMessagesQuota = Number(env.FREE_MESSAGES_QUOTA_PER_MONTH || 50_000);
    const pricePerMillionMessages = Number(env.PRICE_PER_MILLION_MESSAGES || 1);
    const pricePerAgentInvoke = Number(env.PRICE_PER_AGENT_INVOKE || 0);
    const estimatedMonthlyRevenue =
      (monthlyMessages / 1_000_000) * pricePerMillionMessages +
      monthlyAgentInvokes * pricePerAgentInvoke;
    const convertedToPaid = monthlyMessages > freeMessagesQuota || estimatedMonthlyRevenue > 0;

    return json({
      projectId: auth.projectId,
      generatedAt: new Date().toISOString(),
      activation: {
        completedOnboardingSteps,
        totalOnboardingSteps,
        activationRate,
        checks: onboardingChecks,
      },
      retention: {
        activeDaysLast7,
        activeDaysPrev7,
        retainedDevelopers,
        trend: activeDaysLast7 - activeDaysPrev7,
      },
      conversion: {
        monthlyMessages,
        monthlyAgentInvokes,
        freeMessagesQuota,
        estimatedMonthlyRevenue,
        convertedToPaid,
      },
    });
  }

  if (url.pathname === "/stats/ai" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as runs, COALESCE(SUM(input_tokens),0) as inputTokens, COALESCE(SUM(output_tokens),0) as outputTokens, COALESCE(SUM(estimated_cost),0) as estimatedCost FROM agent_runs WHERE project_id = ?"
    )
      .bind(auth.projectId)
      .first();
    return json({
      projectId: auth.projectId,
      runs: Number(row?.runs || 0),
      inputTokens: Number(row?.inputTokens || 0),
      outputTokens: Number(row?.outputTokens || 0),
      estimatedCost: Number(row?.estimatedCost || 0),
    });
  }

  if (url.pathname === "/stats/ops" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const minutes = Math.max(
      5,
      Math.min(Number(url.searchParams.get("minutes") || "60"), 1440)
    );
    const fromBucket = toMinuteBucketIso(new Date(Date.now() - minutes * 60_000));
    const rows = await env.DB.prepare(
      "SELECT metric_name, bucket_minute, metric_value FROM operational_metrics WHERE project_id = ? AND bucket_minute >= ? ORDER BY bucket_minute DESC"
    )
      .bind(auth.projectId, fromBucket)
      .all();
    const data = rows.results || [];
    const totals = data.reduce((acc, row) => {
      const metricName = row.metric_name;
      const value = Number(row.metric_value || 0);
      acc[metricName] = (acc[metricName] || 0) + value;
      return acc;
    }, {});
    return json({
      projectId: auth.projectId,
      windowMinutes: minutes,
      totals,
      points: data,
    });
  }

  if (url.pathname === "/stats/slo" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const minutes = Math.max(
      5,
      Math.min(Number(url.searchParams.get("minutes") || "60"), 1440)
    );
    const fromBucket = toMinuteBucketIso(new Date(Date.now() - minutes * 60_000));
    const opsRows = await env.DB.prepare(
      "SELECT metric_name, COALESCE(SUM(metric_value),0) as total FROM operational_metrics WHERE project_id = ? AND bucket_minute >= ? GROUP BY metric_name"
    )
      .bind(auth.projectId, fromBucket)
      .all();
    const opsTotals = {};
    for (const row of opsRows.results || []) {
      opsTotals[row.metric_name] = Number(row.total || 0);
    }

    const requestsTotal = Number(opsTotals.requests_total || 0);
    const requestsError = Number(opsTotals.requests_error || 0);
    const requestErrorRate = requestsTotal > 0 ? requestsError / requestsTotal : 0;

    const deliveriesFrom = new Date(Date.now() - minutes * 60_000).toISOString();
    const deliveriesRow = await env.DB.prepare(
      "SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END),0) as delivered, COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),0) as failed FROM webhook_deliveries WHERE project_id = ? AND created_at >= ?"
    )
      .bind(auth.projectId, deliveriesFrom)
      .first();
    const deliveryTotal = Number(deliveriesRow?.total || 0);
    const deliveryDelivered = Number(deliveriesRow?.delivered || 0);
    const webhookSuccessRate =
      deliveryTotal > 0 ? deliveryDelivered / deliveryTotal : 1;

    const targetRequestErrorRate = Number(env.SLO_TARGET_REQUEST_ERROR_RATE || 0.01); // <= 1%
    const targetWebhookSuccessRate = Number(env.SLO_TARGET_WEBHOOK_SUCCESS_RATE || 0.98); // >= 98%
    const requestSloMet = requestErrorRate <= targetRequestErrorRate;
    const webhookSloMet = webhookSuccessRate >= targetWebhookSuccessRate;
    const healthScore = Math.round(
      (((requestSloMet ? 1 : 0) + (webhookSloMet ? 1 : 0)) / 2) * 100
    );

    return json({
      projectId: auth.projectId,
      windowMinutes: minutes,
      sli: {
        requestErrorRate,
        webhookSuccessRate,
      },
      sloTargets: {
        requestErrorRateMax: targetRequestErrorRate,
        webhookSuccessRateMin: targetWebhookSuccessRate,
      },
      sloStatus: {
        requestErrorRateMet: requestSloMet,
        webhookSuccessRateMet: webhookSloMet,
        overallHealthy: requestSloMet && webhookSloMet,
        healthScore,
      },
      counters: {
        requestsTotal,
        requestsError,
        webhookDeliveriesTotal: deliveryTotal,
        webhookDeliveriesDelivered: deliveryDelivered,
        webhookDeliveriesFailed: Number(deliveriesRow?.failed || 0),
      },
    });
  }

  if (url.pathname === "/stats/alerts" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const limit = Math.max(10, Math.min(Number(url.searchParams.get("limit") || "100"), 500));
    const rows = await env.DB.prepare(
      "SELECT id, rule_id, metric_name, observed_value, threshold_value, status, severity, message, created_at, resolved_at FROM operational_alert_events WHERE project_id = ? ORDER BY created_at DESC LIMIT ?"
    )
      .bind(auth.projectId, limit)
      .all();
    const openCountRow = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM operational_alert_events WHERE project_id = ? AND status = 'open'"
    )
      .bind(auth.projectId)
      .first();
    return json({
      projectId: auth.projectId,
      openAlerts: Number(openCountRow?.c || 0),
      alerts: rows.results || [],
    });
  }

  if (url.pathname === "/stats/alerts/evaluate" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const result = await evaluateOperationalAlerts(env, auth.projectId);
    return json({ projectId: auth.projectId, ...result });
  }

  return null;
}
