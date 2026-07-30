import { resolveAdminContext } from "../lib/admin-route-context.js";
import { importAdminMessage, importAdminMessageBatch } from "../lib/message-import.js";

export async function dispatchMessageImportRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/messages/import")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "POST" && path === "/admin/messages/import") {
    const body = await request.json();
    const result = await importAdminMessage(env, {
      projectId,
      roomId: body.roomId,
      content: body.content,
      userId: body.userId || userId,
      createdAt: body.createdAt,
      clientMessageId: body.clientMessageId,
      parentId: body.parentId,
      importedBy: userId,
    });
    if (result.error) return respond(result, h, 400);
    if (result.skipped) return respond(result, h, 200);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/messages/import/batch") {
    const body = await request.json();
    const rows = Array.isArray(body.messages) ? body.messages : body;
    const result = await importAdminMessageBatch(env, {
      projectId,
      messages: rows,
      importedBy: userId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  return null;
}
