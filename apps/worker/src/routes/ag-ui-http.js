import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { agentRunToAgUiEvents, encodeAgUiSse } from "../lib/ag-ui-room.js";

/**
 * AG-UI join: an external agent runtime attaches to a room and reads last-run events.
 * Live token stream still goes through the room WebSocket / Agent DO, not this replay.
 */
export async function dispatchAgUiRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/ag-ui")) return null;

  const {
    env,
    corsHeaders,
    json,
    verifyJwtAndGetContext,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "verifyJwtAndGetContext",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (request.method === "POST" && path === "/ag-ui/join") {
    const body = await request.json().catch(() => null);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    if (!roomId) return json({ error: "room_id_required" }, { status: 400 });
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });
    return json({
      ok: true,
      protocol: "ag-ui",
      roomId,
      participantType: "ai",
      eventsUrl: `/ag-ui/events?roomId=${encodeURIComponent(roomId)}`,
      note: "Replay of the latest agent_runs row as AG-UI events. Live tokens use the room socket.",
    });
  }

  if (request.method === "GET" && path === "/ag-ui/events") {
    const roomId = url.searchParams.get("roomId")?.trim() || "";
    if (!roomId) return json({ error: "room_id_required" }, { status: 400 });
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });
    const row = await env.DB.prepare(
      `SELECT id, agent_id, status, latency_ms, estimated_cost, tool_calls_json, created_at
       FROM agent_runs
       WHERE project_id = ? AND room_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(auth.projectId, roomId)
      .first();
    let toolCalls = [];
    if (row?.tool_calls_json) {
      try {
        toolCalls = JSON.parse(row.tool_calls_json);
      } catch {
        toolCalls = [];
      }
    }
    const run = row
      ? {
          id: row.id,
          agentId: row.agent_id,
          roomId,
          status: row.status,
          latencyMs: row.latency_ms,
          estimatedCost: row.estimated_cost,
          toolCalls,
          createdAt: row.created_at,
        }
      : null;
    const events = run ? agentRunToAgUiEvents(run) : [];
    const stream = url.searchParams.get("stream") === "1";
    if (stream) {
      return new Response(encodeAgUiSse(events), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    return json({ ok: true, roomId, run, events });
  }

  return json({ error: "not_found" }, { status: 404 });
}
