import { pickRouteDeps } from "./route-http-deps.js";
import {
  buildEnterpriseAgentRoomPreview,
  provisionEnterpriseAgentRoom,
} from "../lib/enterprise-agent-room-pack.js";

/** NW-202 Enterprise Agent Room pack */
export async function dispatchEnterpriseAgentRoomRoutes(request, url, h) {
  if (!url.pathname.startsWith("/packs/enterprise-agent-room")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
    validateRoomName,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
    "validateRoomName",
  ]);

  if (request.method === "GET" && url.pathname === "/packs/enterprise-agent-room") {
    return json(
      { ok: true, pack: buildEnterpriseAgentRoomPreview() },
      { headers: corsHeaders },
    );
  }

  if (request.method !== "POST" || url.pathname !== "/packs/enterprise-agent-room") {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const nameValidation = validateRoomName(body?.name || "Enterprise Agent Room");
    if (!nameValidation.valid) {
      return json({ error: nameValidation.error }, { status: 400, headers: corsHeaders });
    }

    const result = await provisionEnterpriseAgentRoom(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      name: nameValidation.name,
      async createRoom({ name, type, members }) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(id, auth.projectId, type, name, now)
          .run();
        const memberRows = members?.length
          ? members
          : [{ userId: auth.userId, role: "owner" }];
        for (const m of memberRows) {
          await env.DB.prepare(
            "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
          )
            .bind(id, m.userId, m.role || "member", now)
            .run();
        }
        return { id, name, type, created_at: now };
      },
      async postWelcome(roomId, content) {
        const stub = env.ROOM?.get?.(env.ROOM.idFromName(roomId));
        if (!stub) return;
        await stub.fetch("https://internal/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: auth.userId,
            content,
            projectId: auth.projectId,
          }),
        }).catch(() => {});
      },
    });

    return json(result, { status: 201, headers: corsHeaders });
  } catch (err) {
    logError("enterprise_agent_room.provision_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
