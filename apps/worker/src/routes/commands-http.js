/**
 * P19-J: Command Palette HTTP Routes.
 *
 * GET  /commands                 — list available commands
 * POST /commands/parse           — parse a command from text
 * POST /commands/execute         — execute a command
 * GET  /commands/autocomplete    — autocomplete suggestions
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  parseCommand,
  listCommands,
  getAutocompleteSuggestions,
  executeCommand,
} from "../lib/room-commands.js";

export async function dispatchCommandRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError"]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
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
    if (!body?.command) return json({ error: "command required" }, { status: 400 });

    const result = await executeCommand(env, {
      projectId: a.projectId,
      roomId: body.roomId || "default",
      userId: a.userId,
      userRole: a.roles?.[0] || "member",
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
