/**
 * P19-J / #60: Command Palette HTTP Routes.
 *
 * GET  /commands                      — list available commands
 * POST /commands/parse                — parse a command from text
 * POST /commands/execute              — execute a command
 * GET  /commands/autocomplete         — autocomplete suggestions
 * GET  /admin/room-commands           — list tenant custom commands
 * POST /admin/room-commands           — create custom command
 * PATCH /admin/room-commands/:id      — update custom command
 * DELETE /admin/room-commands/:id     — delete custom command
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  parseCommand,
  listCommands,
  getAutocompleteSuggestions,
  executeCommand,
  resolveHighestRole,
  listCustomCommands,
  createCustomCommand,
  updateCustomCommand,
  deleteCustomCommand,
} from "../lib/room-commands.js";
import { getRoomMemberRole } from "../lib/message-decisions.js";
import { tryDispatchSlashCommand } from "../lib/room-command-dispatch.js";

export async function dispatchCommandRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  const adminCmdMatch = url.pathname.match(/^\/admin\/room-commands(?:\/([^/]+))?$/);

  if (adminCmdMatch) {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const commandId = adminCmdMatch[1] ? decodeURIComponent(adminCmdMatch[1]) : null;

    if (!commandId && request.method === "GET") {
      const commands = await listCustomCommands(env, { projectId: a.projectId });
      return json({ commands });
    }

    if (!commandId && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body?.command || !body?.description) {
        return json({ error: "command and description required" }, { status: 400 });
      }
      const result = await createCustomCommand(env, {
        projectId: a.projectId,
        command: body.command,
        description: body.description,
        usage: body.usage,
        handler: body.handler,
        requiredRole: body.requiredRole ?? body.required_role,
        config: body.config,
      });
      if (!result.ok) return json({ error: result.error }, { status: result.status || 400 });
      return json(result, { status: 201 });
    }

    if (commandId && request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const result = await updateCustomCommand(env, {
        projectId: a.projectId,
        commandId,
        patch: body ?? {},
      });
      if (!result.ok) return json({ error: result.error }, { status: result.status || 400 });
      return json({ ok: true });
    }

    if (commandId && request.method === "DELETE") {
      const result = await deleteCustomCommand(env, { projectId: a.projectId, commandId });
      if (!result.ok) return json({ error: result.error }, { status: result.status || 404 });
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, { status: 405 });
  }

  // GET /commands
  if (url.pathname === "/commands" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const commands = await listCommands(env, { projectId: a.projectId });
    return json({ commands });
  }

  // POST /commands/parse
  if (url.pathname === "/commands/parse" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.content) return json({ error: "content required" }, { status: 400 });
    const parsed = parseCommand(body.content);
    return json({ parsed, isCommand: parsed !== null });
  }

  // POST /commands/execute
  if (url.pathname === "/commands/execute" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.command && !body?.content) {
      return json({ error: "command or content required" }, { status: 400 });
    }

    const roomId = body.roomId || "default";
    if (body.content) {
      const dispatch = await tryDispatchSlashCommand(env, {
        projectId: a.projectId,
        roomId,
        userId: a.userId,
        content: body.content,
        jwtRoles: a.roles ?? [],
        parentId: body.parentId ?? null,
      });
      if (dispatch.handled) {
        return json(
          {
            ...dispatch.commandResult,
            message: dispatch.message ?? undefined,
            command: true,
          },
          { status: dispatch.ok ? 200 : (dispatch.status || 500) },
        );
      }
    }

    const memberRole = await getRoomMemberRole(env, roomId, a.userId, a.roles ?? []);
    const userRole = resolveHighestRole([memberRole, ...(a.roles ?? [])]);
    const result = await executeCommand(env, {
      projectId: a.projectId,
      roomId,
      userId: a.userId,
      userRole,
      command: body.command,
      args: body.args || [],
      rawArgs: body.rawArgs || "",
    });
    return json(result, { status: result.ok ? 200 : (result.status || 500) });
  }

  // GET /commands/autocomplete
  if (url.pathname === "/commands/autocomplete" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const partial = url.searchParams.get("q") || "";
    const suggestions = await getAutocompleteSuggestions(env, { projectId: a.projectId, partial });
    return json({ suggestions });
  }

  return null;
}
