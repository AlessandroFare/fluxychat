import { pickRouteDeps } from "./route-http-deps.js";
import { logError } from "../lib/worker-log.js";

/**
 * @param {Request} request
 * @param {URL} url
 * @param {Record<string, unknown>} h
 */
export async function dispatchCollabRoutes(request, url, h) {
  const {
    env, json, corsHeaders, verifyJwtAndGetContext,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "verifyJwtAndGetContext"]);

  if (!url.pathname.startsWith("/collab")) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const projectId = auth.projectId;
  const userId = auth.userId;
  const path = url.pathname;
  const method = request.method;

  try {
    // ── Files ────────────────────────────

    if (path === "/collab/files" && method === "GET" && url.searchParams.has("roomId")) {
      const roomId = url.searchParams.get("roomId");
      const { results } = await env.DB.prepare(
        "SELECT id, name, path, mime_type, size_bytes, created_by, created_at, updated_at FROM collab_files WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
      ).bind(projectId, roomId).all();
      return json({ files: results });
    }

    if (path === "/collab/files/upload" && method === "POST") {
      const roomId = url.searchParams.get("roomId");
      if (!roomId) return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return json({ error: "file required" }, { status: 400, headers: corsHeaders });
      const name = file.name;
      const mimeType = file.type || "application/octet-stream";
      const r2Key = `${projectId}/${roomId}/${Date.now()}-${name}`;
      const buffer = await file.arrayBuffer();
      const size = buffer.byteLength;
      await env.ATTACHMENTS.put(r2Key, buffer, { httpMetadata: { contentType: mimeType } });
      const { meta } = await env.DB.prepare(
        "INSERT INTO collab_files (project_id, room_id, name, path, mime_type, size_bytes, r2_key, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(projectId, roomId, name, "/", mimeType, size, r2Key, userId).run();
      return json({ ok: true, id: meta.last_row_id }, { status: 201, headers: corsHeaders });
    }

    const fileDownloadMatch = path.match(/^\/collab\/files\/download\/(.+)$/);
    if (fileDownloadMatch && method === "GET") {
      const fileId = fileDownloadMatch[1];
      const row = await env.DB.prepare(
        "SELECT name, mime_type, r2_key FROM collab_files WHERE id = ? AND project_id = ? AND deleted_at IS NULL"
      ).bind(fileId, projectId).first();
      if (!row) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      const obj = await env.ATTACHMENTS.get(row.r2_key);
      if (!obj) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      const body = await obj.arrayBuffer();
      return new Response(body, {
        headers: {
          "Content-Type": row.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${row.name}"`,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const fileDeleteMatch = path.match(/^\/collab\/files\/([^/]+)$/);
    if (fileDeleteMatch && method === "DELETE") {
      await env.DB.prepare(
        "UPDATE collab_files SET deleted_at = datetime('now') WHERE id = ? AND project_id = ?"
      ).bind(fileDeleteMatch[1], projectId).run();
      return json({ ok: true });
    }

    // ── Calendar Events ──────────────────

    if (path === "/collab/events" && method === "GET" && url.searchParams.has("roomId")) {
      const roomId = url.searchParams.get("roomId");
      const { results } = await env.DB.prepare(
        "SELECT id, title, description, start_time, end_time, all_day, color, created_by, created_at, updated_at FROM collab_events WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY start_time ASC"
      ).bind(projectId, roomId).all();
      return json({ events: results });
    }

    if (path === "/collab/events" && method === "POST" && url.searchParams.has("roomId")) {
      const roomId = url.searchParams.get("roomId");
      const body = await request.json();
      const { title, description, startTime, endTime, allDay, color } = body;
      if (!title || !startTime || !endTime) return json({ error: "title, startTime, endTime required" }, { status: 400, headers: corsHeaders });
      const { meta } = await env.DB.prepare(
        "INSERT INTO collab_events (project_id, room_id, title, description, start_time, end_time, all_day, color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(projectId, roomId, title, description || null, startTime, endTime, allDay ? 1 : 0, color || null, userId).run();
      return json({ ok: true, id: meta.last_row_id }, { status: 201, headers: corsHeaders });
    }

    const eventUpdateMatch = path.match(/^\/collab\/events\/([^/]+)$/);
    if (eventUpdateMatch && method === "PUT") {
      const body = await request.json();
      const sets = []; const binds = [];
      if (body.title !== undefined) { sets.push("title = ?"); binds.push(body.title); }
      if (body.description !== undefined) { sets.push("description = ?"); binds.push(body.description); }
      if (body.startTime !== undefined) { sets.push("start_time = ?"); binds.push(body.startTime); }
      if (body.endTime !== undefined) { sets.push("end_time = ?"); binds.push(body.endTime); }
      if (body.color !== undefined) { sets.push("color = ?"); binds.push(body.color); }
      sets.push("updated_at = datetime('now')");
      binds.push(eventUpdateMatch[1], projectId);
      await env.DB.prepare(`UPDATE collab_events SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`).bind(...binds).run();
      return json({ ok: true });
    }

    if (eventUpdateMatch && method === "DELETE") {
      await env.DB.prepare("UPDATE collab_events SET deleted_at = datetime('now') WHERE id = ? AND project_id = ?").bind(eventUpdateMatch[1], projectId).run();
      return json({ ok: true });
    }
  } catch (e) {
    logError("collab.route_error", e, { path, method, projectId });
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }

  return null;
}
