import { pickRouteDeps } from "./route-http-deps.js";

/**
 * Unified project activity feed (messages automation, webhooks, agent runs).
 * @returns {Promise<Response|null>}
 */
export async function dispatchActivitiesRoutes(request, url, h) {
  const { env, json, corsHeaders, verifyJwtAndGetContext, hasAnyRole } = pickRouteDeps(
    h,
    ["env", "json", "corsHeaders", "verifyJwtAndGetContext", "hasAnyRole"],
  );

  if (url.pathname !== "/activities" || request.method !== "GET") return null;

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "60"), 1), 200);
  const roomId = url.searchParams.get("roomId")?.trim() || "";
  const { projectId: authProjectId } = auth;
  const perSource = Math.min(limit, 80);

  const automationSql = roomId
    ? `SELECT id, event_type, room_id, payload, created_at
       FROM automation_events
       WHERE project_id = ? AND room_id = ?
       ORDER BY created_at DESC LIMIT ?`
    : `SELECT id, event_type, room_id, payload, created_at
       FROM automation_events
       WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`;
  const automationBinds = roomId
    ? [authProjectId, roomId, perSource]
    : [authProjectId, perSource];

  const agentSql = roomId
    ? `SELECT id, agent_id, room_id, status, error, latency_ms, created_at
       FROM agent_runs
       WHERE project_id = ? AND room_id = ?
       ORDER BY created_at DESC LIMIT ?`
    : `SELECT id, agent_id, room_id, status, error, latency_ms, created_at
       FROM agent_runs
       WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`;
  const agentBinds = roomId ? [authProjectId, roomId, perSource] : [authProjectId, perSource];

  const [automationRows, webhookRows, agentRows] = await Promise.all([
    env.DB.prepare(automationSql)
      .bind(...automationBinds)
      .all()
      .then((r) => r.results || []),
    env.DB.prepare(
      `SELECT id, webhook_id, event_type, status, attempt_count, last_error, payload, created_at
       FROM webhook_deliveries
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
      .bind(authProjectId, perSource)
      .all()
      .then((r) => r.results || []),
    env.DB.prepare(agentSql)
      .bind(...agentBinds)
      .all()
      .then((r) => r.results || []),
  ]);

  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  for (const row of automationRows) {
    items.push({
      id: `automation:${row.id}`,
      kind: "automation",
      title: String(row.event_type || "automation"),
      status: "recorded",
      roomId: row.room_id ?? undefined,
      createdAt: row.created_at,
      detail: typeof row.payload === "string" ? row.payload.slice(0, 240) : undefined,
    });
  }

  for (const row of webhookRows) {
    let payloadRoom;
    try {
      const parsed = JSON.parse(String(row.payload || "{}"));
      payloadRoom =
        typeof parsed.roomId === "string"
          ? parsed.roomId
          : typeof parsed.room_id === "string"
            ? parsed.room_id
            : undefined;
    } catch {
      payloadRoom = undefined;
    }
    if (roomId && payloadRoom && payloadRoom !== roomId) continue;
    items.push({
      id: `webhook:${row.id}`,
      kind: "webhook",
      title: String(row.event_type || "webhook"),
      status: String(row.status || "pending"),
      roomId: payloadRoom,
      createdAt: row.created_at,
      detail:
        row.last_error ||
        (row.attempt_count != null ? `attempts: ${row.attempt_count}` : undefined),
      webhookId: row.webhook_id,
    });
  }

  for (const row of agentRows) {
    items.push({
      id: `agent_run:${row.id}`,
      kind: "agent_run",
      title: `Agent run`,
      status: String(row.status || "unknown"),
      roomId: row.room_id ?? undefined,
      createdAt: row.created_at,
      detail: row.error || (row.latency_ms != null ? `${row.latency_ms}ms` : undefined),
      agentId: row.agent_id,
    });
  }

  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json({ activities: items.slice(0, limit) });
}
