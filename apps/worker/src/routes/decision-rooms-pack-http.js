import { pickRouteDeps } from "./route-http-deps.js";
import {
  buildDecisionRoomPackPreview,
  provisionDecisionRoomPack,
} from "../lib/decision-rooms-pack.js";

/**
 * NW-201 Decision Rooms™ pack routes.
 * GET  /packs/decision-rooms — preview
 * POST /packs/decision-rooms — provision room + templates
 */
export async function dispatchDecisionRoomsPackRoutes(request, url, h) {
  if (!url.pathname.startsWith("/packs/decision-rooms")) return null;

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

  if (request.method === "GET" && url.pathname === "/packs/decision-rooms") {
    return json(
      { ok: true, pack: buildDecisionRoomPackPreview({ name: "Decision Room" }) },
      { headers: corsHeaders },
    );
  }

  if (request.method !== "POST" || url.pathname !== "/packs/decision-rooms") {
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
    const nameValidation = validateRoomName(body?.name || "Decision Room");
    if (!nameValidation.valid) {
      return json({ error: nameValidation.error }, { status: 400, headers: corsHeaders });
    }

    const result = await provisionDecisionRoomPack(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      name: nameValidation.name,
      async createRoom({ name, type }) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(id, auth.projectId, type, name, now)
          .run();
        await env.DB.prepare(
          "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
        )
          .bind(id, auth.userId, "owner", now)
          .run()
          .catch(() => {});
        return { id, name, type, created_at: now };
      },
      async createTemplate({ name, body: templateBody }) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO message_templates (id, project_id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
          .bind(id, auth.projectId, name, templateBody, now, now)
          .run();
        return { id, name, body: templateBody };
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
    logError("decision_rooms.provision_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
