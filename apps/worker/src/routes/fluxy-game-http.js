import { pickRouteDeps } from "./route-http-deps.js";
import {
  endGameMatch,
  findOrCreateLobby,
  getGameMatch,
  startGameMatch,
  submitGameInput,
  upsertGamePlayer,
} from "../lib/fluxy-game.js";
import {
  getGameCheckpoint,
  getGameCheckpointMerged,
  listGameCheckpoints,
  listGameCheckpointsMerged,
  upsertGameCheckpoint,
  federateGameCheckpoint,
} from "../lib/game-checkpoint.js";
import { fetchGameCheckpointCrdtSnapshot } from "../lib/yjs-game-checkpoint.js";
import {
  createGameQuest,
  listGameQuests,
  moderateGameQuest,
  updateGameQuestProgress,
} from "../lib/game-quest.js";
import {
  createGameTournament,
  getGameTournament,
  listGameTournaments,
  reportTournamentMatch,
  startGameTournament,
} from "../lib/game-tournament.js";
import { interactGameNpc, listGameNpcs, upsertGameNpc } from "../lib/game-npc.js";

export async function dispatchFluxyGameRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/games/")) return null;

  if (path === "/games/players" && request.method === "PUT") {
    return dispatchUpsertPlayer(request, h);
  }
  if (path === "/games/npcs" && request.method === "GET") {
    return dispatchListNpcs(request, h);
  }
  if (path === "/games/npcs" && request.method === "PUT") {
    return dispatchUpsertNpc(request, h);
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

  const npcInteract = path.match(/^\/games\/npcs\/([^/]+)\/interact$/);
  if (npcInteract && request.method === "POST") {
    return dispatchNpcInteract(request, h, decodeURIComponent(npcInteract[1]));
  }

  if (path === "/games/checkpoints" && request.method === "GET") {
    return dispatchListCheckpoints(request, h);
  }
  if (path === "/games/checkpoints/crdt-snapshot" && request.method === "GET") {
    return dispatchCheckpointCrdtSnapshot(request, h);
  }
  if (path === "/games/checkpoints" && request.method === "PUT") {
    return dispatchUpsertCheckpoint(request, h);
  }

  const checkpointGet = path.match(/^\/games\/checkpoints\/([^/]+)$/);
  if (checkpointGet && request.method === "GET") {
    return dispatchGetCheckpoint(request, h, decodeURIComponent(checkpointGet[1]));
  }

  const checkpointFederate = path.match(/^\/games\/checkpoints\/([^/]+)\/federate$/);
  if (checkpointFederate && request.method === "POST") {
    return dispatchFederateCheckpoint(request, h, decodeURIComponent(checkpointFederate[1]));
  }

  if (path === "/games/quests" && request.method === "GET") {
    return dispatchListQuests(request, h);
  }
  if (path === "/games/quests" && request.method === "POST") {
    return dispatchCreateQuest(request, h);
  }

  const questModerate = path.match(/^\/games\/quests\/([^/]+)\/moderate$/);
  if (questModerate && request.method === "POST") {
    return dispatchModerateQuest(request, h, decodeURIComponent(questModerate[1]));
  }

  const questProgress = path.match(/^\/games\/quests\/([^/]+)\/progress$/);
  if (questProgress && request.method === "POST") {
    return dispatchQuestProgress(request, h, decodeURIComponent(questProgress[1]));
  }

  if (path === "/games/tournaments" && request.method === "GET") {
    return dispatchListTournaments(request, h);
  }
  if (path === "/games/tournaments" && request.method === "POST") {
    return dispatchCreateTournament(request, h);
  }

  const tournamentGet = path.match(/^\/games\/tournaments\/([^/]+)$/);
  if (tournamentGet && request.method === "GET") {
    return dispatchGetTournament(request, h, decodeURIComponent(tournamentGet[1]));
  }

  const tournamentStart = path.match(/^\/games\/tournaments\/([^/]+)\/start$/);
  if (tournamentStart && request.method === "POST") {
    return dispatchStartTournament(request, h, decodeURIComponent(tournamentStart[1]));
  }

  const tournamentReport = path.match(/^\/games\/tournaments\/([^/]+)\/matches\/([^/]+)\/report$/);
  if (tournamentReport && request.method === "POST") {
    return dispatchReportTournamentMatch(request, h, decodeURIComponent(tournamentReport[1]), decodeURIComponent(tournamentReport[2]));
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

async function dispatchListNpcs(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const npcs = await listGameNpcs(env, auth);
  return json({ ok: true, npcs }, { headers: corsHeaders });
}

async function dispatchUpsertNpc(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await upsertGameNpc(env, auth, body ?? {});
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

async function dispatchNpcInteract(request, h, npcId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await interactGameNpc(env, auth, npcId, body ?? {});
  if (!result.ok) {
    const status = result.error === "rate_limit_exceeded" ? 429 : result.error === "npc_not_found" ? 404 : 400;
    return json(result, { status, headers: corsHeaders });
  }
  return json(result, { headers: corsHeaders });
}

async function dispatchListCheckpoints(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId") ?? auth.userId;
  const roomId = url.searchParams.get("roomId") ?? "";
  const crdt = url.searchParams.get("crdt") === "1" || url.searchParams.get("crdt") === "true";
  const result = crdt && roomId
    ? await listGameCheckpointsMerged(env, auth, playerId, roomId)
    : await listGameCheckpoints(env, auth, playerId);
  return json(result, { headers: corsHeaders });
}

async function dispatchCheckpointCrdtSnapshot(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return json({ error: "roomId_required" }, { status: 400, headers: corsHeaders });
  try {
    const snapshot = await fetchGameCheckpointCrdtSnapshot(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
    });
    if (!snapshot) return json({ error: "crdt_snapshot_failed" }, { status: 502, headers: corsHeaders });
    return json(snapshot, { headers: corsHeaders });
  } catch {
    return json({ error: "crdt_snapshot_failed" }, { status: 500, headers: corsHeaders });
  }
}

async function dispatchGetCheckpoint(request, h, checkpointKey) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId") ?? auth.userId;
  const roomId = url.searchParams.get("roomId") ?? "";
  const crdt = url.searchParams.get("crdt") === "1" || url.searchParams.get("crdt") === "true";
  const result = crdt && roomId
    ? await getGameCheckpointMerged(env, auth, checkpointKey, playerId, roomId)
    : await getGameCheckpoint(env, auth, checkpointKey, playerId);
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchUpsertCheckpoint(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await upsertGameCheckpoint(env, auth, body ?? {});
  if (!result.ok) {
    const status = result.conflict ? 409 : 400;
    return json(result, { status, headers: corsHeaders });
  }
  return json(result, { headers: corsHeaders });
}

async function dispatchFederateCheckpoint(request, h, checkpointKey) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => ({}));
  const result = await federateGameCheckpoint(env, auth, {
    checkpointKey,
    playerId: body.playerId,
    sourceRoomId: body.sourceRoomId ?? body.roomId,
    targetRoomId: body.targetRoomId,
  });
  if (!result.ok) {
    const status = result.error === "checkpoint_not_found" ? 404 : 400;
    return json(result, { status, headers: corsHeaders });
  }
  return json(result, { headers: corsHeaders });
}

async function dispatchListQuests(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const url = new URL(request.url);
  const result = await listGameQuests(env, auth, {
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  return json(result, { headers: corsHeaders });
}

async function dispatchCreateQuest(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await createGameQuest(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchModerateQuest(request, h, questId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await moderateGameQuest(env, auth, questId, body?.decision);
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchQuestProgress(request, h, questId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await updateGameQuestProgress(env, auth, questId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchListTournaments(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const url = new URL(request.url);
  const result = await listGameTournaments(env, auth, { status: url.searchParams.get("status") ?? undefined });
  return json(result, { headers: corsHeaders });
}

async function dispatchCreateTournament(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await createGameTournament(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetTournament(request, h, tournamentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getGameTournament(env, auth, tournamentId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchStartTournament(request, h, tournamentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await startGameTournament(env, auth, tournamentId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchReportTournamentMatch(request, h, tournamentId, matchId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await reportTournamentMatch(env, auth, tournamentId, matchId, body?.winner);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
