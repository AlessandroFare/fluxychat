import { pickRouteDeps } from "./route-http-deps.js";
import { cardToFallbackText } from "../lib/cards.js";

const CARD_MARKER_START = "<!--fluxy-card:v1-->";
const CARD_MARKER_END = "<!--/fluxy-card-->";

function serializeCardMessage(card, fallbackText) {
  const fallback = fallbackText ?? cardToFallbackText(card);
  return `${CARD_MARKER_START}\n${JSON.stringify(card)}\n${CARD_MARKER_END}\n${fallback}`;
}

/**
 * POST /api/cards/send — post an interactive card to a room.
 */
export async function dispatchCardsRoutes(request, url, h) {
  if (url.pathname !== "/api/cards/send" || request.method !== "POST") return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    canAccessRoom,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "canAccessRoom",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    return null;
  });
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const roomId = String(body.roomId || "").trim();
  const card = body.card;
  if (!roomId || !card || card.type !== "card") {
    return json({ error: "roomId and card (type=card) required" }, { status: 400, headers: corsHeaders });
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    const fallback = cardToFallbackText(card);
    const content = serializeCardMessage(card, fallback);
    const createdAt = new Date().toISOString();
    const insertRes = await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(auth.projectId, roomId, auth.userId, content, createdAt, body.parentId ?? null)
      .run();

    const messageId = insertRes.meta.last_row_id;
    const message = {
      id: messageId,
      roomId,
      userId: auth.userId,
      content,
      createdAt,
      card,
    };

    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({ type: "message", ...message }),
    }).catch((err) => logError("cards.announce_failed", err, requestLogCtx));

    return json({ ok: true, message }, { headers: corsHeaders });
  } catch (err) {
    logError("cards.send_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
