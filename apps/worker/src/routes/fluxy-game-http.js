import { pickRouteDeps } from "./route-http-deps.js";
import {
  endGameMatch,
  findOrCreateLobby,
  getGameMatch,
  startGameMatch,
  submitGameInput,
  upsertGamePlayer,
} from "../lib/fluxy-game.js";

export async function dispatchFluxyGameRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/games/")) return null;

  if (path === "/games/players" && request.method === "PUT") {
    return dispatchUpsertPlayer(request, h);
  }
  if (path === "/games/lobbies/matchmake" && request.method === "POST") {
    return dispatchMatchmake(request, h);
  }

  const startMatch = path.match(/^\/games\/lobbies\/([^/]+)\/start$/);
  if (startMatch && request.method === "POST") {
    return dispatchStart(request, h, decodeURIComponent(startMatch[1]));
  }

  const matchGet = path.match(/^\/games\/matches\/([^/]+)$/);
  if (matchGet && request.method === "GET") {
    return dispatchGetMatch(request, h, decodeURIComponent(matchGet[1]));
  }

  const inputMatch = path.match(/^\/games\/matches\/([^/]+)\/input$/);
  if (inputMatch && request.method === "POST") {
    return dispatchInput(request, h, decodeURIComponent(inputMatch[1]));
  }

  const endMatch = path.match(/^\/games\/matches\/([^/]+)\/end$/);
  if (endMatch && request.method === "POST") {
    return dispatchEnd(request, h, decodeURIComponent(endMatch[1]));
  }

  return null;
}

async function authContext(request, env, h) {
  const { verifyJwtAndGetContext, logError, requestLogCtx } = pickRouteDeps(h, [
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);
  return verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
}

async function dispatchUpsertPlayer(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await upsertGamePlayer(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchMatchmake(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await findOrCreateLobby(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchStart(request, h, lobbyId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await startGameMatch(env, auth, lobbyId);
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetMatch(request, h, matchId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getGameMatch(env, auth, matchId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchInput(request, h, matchId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await submitGameInput(env, auth, matchId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchEnd(request, h, matchId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await endGameMatch(env, auth, matchId, body?.result);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
