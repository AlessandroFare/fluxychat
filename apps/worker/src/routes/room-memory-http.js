import { pickRouteDeps } from "./route-http-deps.js";
import {
  extractRoomMemory,
  persistRoomMemory,
  queryRoomMemory,
  deleteRoomMemoryEntry,
} from "../lib/room-memory.js";

/**
 * Room Memory HTTP routes.
 *
 * GET  /rooms/:id/memory       — Query memory entries (filterable by kind)
 * POST /rooms/:id/memory/extract — Trigger AI memory extraction on-demand
 * DELETE /rooms/:id/memory/:entryId — Delete a memory entry
 */
export async function dispatchRoomMemoryRoutes(request, url, h) {
  const match = url.pathname.match(
    /^\/rooms\/([^/]+)\/memory(?:\/([^/]+))?(?:\/extract)?$/,
  );
  if (!match) return null;

  const roomId = match[1];
  const entryId = match[2] || null;
  const isExtract = url.pathname.endsWith("/extract");

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
    "canAccessRoom",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && !isExtract && !entryId) {
      return handleGetMemory(request, url, { env, json, corsHeaders, roomId, auth });
    }

    if (request.method === "POST" && isExtract) {
      return handleExtractMemory({ env, json, corsHeaders, roomId, auth, logError, requestLogCtx });
    }

    if (request.method === "DELETE" && entryId) {
      return handleDeleteEntry({ env, json, corsHeaders, roomId, auth, entryId });
    }

    return null;
  } catch (err) {
    logError("room_memory.error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}

async function handleGetMemory(request, url, { env, json, corsHeaders, roomId, auth }) {
  const kind = url.searchParams.get("kind") || undefined;
  const limit = url.searchParams.get("limit") || undefined;

  const result = await queryRoomMemory(env, {
    projectId: auth.projectId,
    roomId,
    kind,
    limit: limit ? Number(limit) : undefined,
  });

  return json({ roomId, entries: result.entries, count: result.entries.length }, { headers: corsHeaders });
}

async function handleExtractMemory({ env, json, corsHeaders, roomId, auth, logError, requestLogCtx }) {
  const extracted = await extractRoomMemory(env, {
    projectId: auth.projectId,
    roomId,
  });

  if (!extracted.ok) {
    return json({ error: extracted.error }, { status: 502, headers: corsHeaders });
  }

  if (!extracted.entries.length) {
    return json({ roomId, entries: [], extracted: 0, message: "No notable memories found" }, { headers: corsHeaders });
  }

  const persisted = await persistRoomMemory(env, {
    projectId: auth.projectId,
    roomId,
    entries: extracted.entries,
  });

  logInfo("room_memory.extracted", {
    ...requestLogCtx,
    roomId,
    extracted: extracted.entries.length,
    inserted: persisted.inserted,
    updated: persisted.updated,
  });

  return json(
    { roomId, entries: extracted.entries, extracted: extracted.entries.length, inserted: persisted.inserted, updated: persisted.updated },
    { headers: corsHeaders },
  );
}

async function handleDeleteEntry({ env, json, corsHeaders, auth, entryId }) {
  await deleteRoomMemoryEntry(env, { projectId: auth.projectId, entryId });
  return json({ deleted: entryId }, { headers: corsHeaders });
}

function logInfo(event, ctx) {
  try {
    console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...ctx }));
  } catch {}
}

