/**
 * Split from worker fetch handler (original lines 2976-3177).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  buildRoomMarkdown,
  buildRoomPdf,
  fetchRoomExportData,
} from "../lib/room-export.js";

export async function dispatchRoomsListExportRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    projectId,
    canAccessRoom,
    attachAttachmentsToMessages,
    canBypassRoomMembership,
    getCachedOrFetch,
    escapeCsvField,
    canCreateTenantProjects,
    tenantScopeForbidden,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "projectId",
    "canAccessRoom",
    "attachAttachmentsToMessages",
    "canBypassRoomMembership",
    "getCachedOrFetch",
    "escapeCsvField",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
  ]);


  if (url.pathname === "/rooms" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const type = url.searchParams.get("type");
    const userIdForUnread = auth.userId;
    let sql =
      "SELECT id, type, name, created_at, pinned_message_id, pinned_at, pinned_by_user_id FROM rooms WHERE project_id = ?";
    const params = [auth.projectId];
    if (!canBypassRoomMembership(auth.roles)) {
      sql += " AND id IN (SELECT room_id FROM room_members WHERE user_id = ?)";
      params.push(auth.userId);
    }
    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }
    sql += " ORDER BY created_at DESC";

    // Cache rooms list for 30 seconds
    const cacheKey = `rooms:${auth.projectId}:${auth.userId}:${type || "all"}`;
    const roomsData = await getCachedOrFetch(
      env,
      cacheKey,
      async () => {
        const rows = await env.DB.prepare(sql).bind(...params).all();
        let rooms = rows.results || [];

        if (userIdForUnread && rooms.length) {
          const roomIds = rooms.map((r) => r.id);
          const placeholders = roomIds.map(() => "?").join(",");
          const receiptRows = await env.DB.prepare(
            `SELECT room_id, MAX(message_id) as lastRead FROM read_receipts WHERE project_id = ? AND user_id = ? AND room_id IN (${placeholders}) GROUP BY room_id`,
          )
            .bind(auth.projectId, userIdForUnread, ...roomIds)
            .all();
          const lastReadMap = new Map(
            (receiptRows.results || []).map((r) => [r.room_id, Number(r.lastRead) || 0]),
          );

          const unreadMap = new Map();
          const roomsWithRead = roomIds.filter((rid) => lastReadMap.has(rid));
          if (roomsWithRead.length) {
            const unionParts = [];
            const unionParams = [];
            for (const rid of roomsWithRead) {
              unionParts.push(
                "SELECT ? as room_id, COUNT(*) as c FROM messages WHERE project_id = ? AND room_id = ? AND id > ? AND deleted_at IS NULL",
              );
              unionParams.push(rid, auth.projectId, rid, lastReadMap.get(rid) || 0);
            }
            const unionSql = unionParts.join(" UNION ALL ");
            const unionResult = await env.DB.prepare(unionSql).bind(...unionParams).all();
            for (const row of unionResult.results || []) {
              unreadMap.set(row.room_id, row.c);
            }
          }

          const neverReadIds = roomIds.filter((rid) => !lastReadMap.has(rid));
          if (neverReadIds.length) {
            const phNever = neverReadIds.map(() => "?").join(",");
            const totalRows = await env.DB.prepare(
              `SELECT room_id, COUNT(*) as c FROM messages WHERE project_id = ? AND room_id IN (${phNever}) AND deleted_at IS NULL GROUP BY room_id`,
            )
              .bind(auth.projectId, ...neverReadIds)
              .all();
            for (const row of totalRows.results || []) {
              unreadMap.set(row.room_id, row.c);
            }
          }

          rooms = rooms.map((r) => ({
            ...r,
            unreadCount: unreadMap.get(r.id) ?? 0,
          }));
        }
        return rooms;
      },
      30
    );

    return json({ rooms: roomsData });
  }

  if (
    url.pathname === "/export/messages.json" &&
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
    const roomId = url.searchParams.get("roomId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!roomId) {
      return json({ error: "roomId required" }, { status: 400 });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    let sql =
      "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions, og_title, og_description, og_image, og_url FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL";
    const params = [auth.projectId, roomId];
    if (from) {
      sql += " AND created_at >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND created_at <= ?";
      params.push(to);
    }
    sql += " ORDER BY created_at ASC";
    const res = await env.DB.prepare(sql).bind(...params).all();
    const rows = res.results || [];
    const mapped = await attachAttachmentsToMessages(
      env,
      auth.projectId,
      roomId,
      rows
    );
    return new Response(JSON.stringify({ messages: mapped }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="messages.json"',
        ...corsHeaders,
      },
    });
  }

  if (
    url.pathname === "/export/messages.csv" &&
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
    const roomId = url.searchParams.get("roomId");
    if (!roomId) {
      return json({ error: "roomId required" }, { status: 400 });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const res = await env.DB.prepare(
      "SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at, mentions FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    )
      .bind(auth.projectId, roomId)
      .all();
    const rows = res.results || [];
    const header = [
      "id",
      "createdAt",
      "roomId",
      "userId",
      "content",
      "parentId",
      "mentions",
    ];
    const csvLines = [header.map(escapeCsvField).join(",")];
    for (const r of rows) {
      const mentions =
        r.mentions && r.mentions.length
          ? JSON.stringify(JSON.parse(r.mentions))
          : "[]";
      const cells = [
        String(r.id),
        String(r.created_at),
        String(r.room_id),
        String(r.user_id),
        String(r.content),
        r.parent_id ?? "",
        String(mentions),
      ];
      csvLines.push(cells.map(escapeCsvField).join(","));
    }
    const body = csvLines.join("\r\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="messages.csv"',
        ...corsHeaders,
      },
    });
  }

  const exportMdMatch = url.pathname.match(/^\/export\/rooms\/([^/]+)\.markdown$/);
  const exportMdAltMatch = url.pathname.match(/^\/export\/rooms\/([^/]+)\/markdown$/);
  const exportPdfMatch = url.pathname.match(/^\/export\/rooms\/([^/]+)\.pdf$/);
  const exportPdfAltMatch = url.pathname.match(/^\/export\/rooms\/([^/]+)\/pdf$/);

  if (
    (exportMdMatch || exportMdAltMatch || exportPdfMatch || exportPdfAltMatch) &&
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

    const roomId = decodeURIComponent(
      (exportMdMatch || exportMdAltMatch || exportPdfMatch || exportPdfAltMatch)[1],
    );
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const exported = await fetchRoomExportData(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      from,
      to,
    });
    if (!exported.ok) {
      return json({ error: exported.error }, { status: 404 });
    }

    const exportedAt = new Date().toISOString();
    const payload = {
      room: exported.room,
      projectId: auth.projectId,
      messages: exported.messages,
      exportedAt,
      truncated: exported.truncated,
    };

    if (writeAuditEvent) {
      await writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "room.export",
        actorUserId: auth.userId,
        targetType: "room",
        targetId: roomId,
        metadata: {
          format: exportPdfMatch || exportPdfAltMatch ? "pdf" : "markdown",
          messageCount: exported.messages.length,
          truncated: exported.truncated,
        },
      });
    }

    const safeName = String(exported.room.name || roomId).replace(/[^a-zA-Z0-9._-]+/g, "_");

    if (exportPdfMatch || exportPdfAltMatch) {
      const pdf = buildRoomPdf(payload);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}-${roomId}.pdf"`,
          ...corsHeaders,
        },
      });
    }

    const markdown = buildRoomMarkdown(payload);
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}-${roomId}.md"`,
        ...corsHeaders,
      },
    });
  }

  return null;
}
