/**
 * D1-backed FluxyGame lobbies and matches (ROADMAP 5.1).
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToLobby(row) {
  return {
    id: row.id,
    roomId: row.room_id || undefined,
    gameMode: row.game_mode,
    maxPlayers: Number(row.max_players),
    hostId: row.host_id,
    state: row.state,
    players: parseJson(row.players_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMatch(row) {
  return {
    id: row.id,
    lobbyId: row.lobby_id || undefined,
    status: row.status,
    state: parseJson(row.state_json, {}),
    result: row.result_json ? parseJson(row.result_json, null) : undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
  };
}

export async function upsertGamePlayer(env, auth, input) {
  const playerId = String(input.playerId ?? auth.userId).trim();
  const username = String(input.username ?? playerId).trim().slice(0, 64);
  if (!playerId || !username) return { ok: false, error: "player_required" };

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO game_player_profiles
     (project_id, player_id, username, skill_rating, region, stats_json, cloud_save_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, player_id) DO UPDATE SET
       username = excluded.username,
       skill_rating = COALESCE(excluded.skill_rating, game_player_profiles.skill_rating),
       region = COALESCE(excluded.region, game_player_profiles.region),
       stats_json = COALESCE(excluded.stats_json, game_player_profiles.stats_json),
       cloud_save_json = COALESCE(excluded.cloud_save_json, game_player_profiles.cloud_save_json),
       updated_at = excluded.updated_at`,
  )
    .bind(
      auth.projectId,
      playerId,
      username,
      Number(input.skillRating) || 1000,
      String(input.region ?? "eu").slice(0, 16),
      input.stats ? JSON.stringify(input.stats) : null,
      input.cloudSave ? JSON.stringify(input.cloudSave) : null,
      now,
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT * FROM game_player_profiles WHERE project_id = ? AND player_id = ?`,
  )
    .bind(auth.projectId, playerId)
    .first();

  return {
    ok: true,
    player: {
      id: row.player_id,
      username: row.username,
      skillRating: Number(row.skill_rating),
      region: row.region,
      stats: parseJson(row.stats_json, {}),
      cloudSave: parseJson(row.cloud_save_json, {}),
    },
  };
}

export async function findOrCreateLobby(env, auth, input) {
  const playerId = String(input.playerId ?? auth.userId).trim();
  const gameMode = String(input.gameMode ?? "deathmatch").slice(0, 32);
  const maxPlayers = Math.min(Math.max(Number(input.maxPlayers) || 4, 2), 16);
  const skillRating = Number(input.skillRating) || 1000;

  const rows = await env.DB.prepare(
    `SELECT * FROM game_lobbies
     WHERE project_id = ? AND game_mode = ? AND state = 'waiting'
     ORDER BY updated_at DESC LIMIT 20`,
  )
    .bind(auth.projectId, gameMode)
    .all();

  for (const row of rows.results || []) {
    const players = parseJson(row.players_json, []);
    if (players.length >= Number(row.max_players)) continue;
    players.push(playerId);
    const now = nowIso();
    await env.DB.prepare(
      `UPDATE game_lobbies SET players_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(JSON.stringify(players), now, row.id, auth.projectId)
      .run();
    return { ok: true, lobby: { ...rowToLobby(row), players } };
  }

  const id = `lobby_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const players = [playerId];
  const effectiveRoomId = input.roomId?.trim() || `game:${auth.projectId}`;
  await env.DB.prepare(
    `INSERT INTO game_lobbies
     (id, project_id, room_id, game_mode, max_players, host_id, state, players_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      effectiveRoomId,
      gameMode,
      maxPlayers,
      playerId,
      JSON.stringify(players),
      now,
      now,
    )
    .run();

  return {
    ok: true,
    lobby: {
      id,
      roomId: effectiveRoomId,
      gameMode,
      maxPlayers,
      hostId: playerId,
      state: "waiting",
      players,
      createdAt: now,
      updatedAt: now,
    },
    skillRating,
  };
}

export async function startGameMatch(env, auth, lobbyId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_lobbies WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, lobbyId)
    .first();
  if (!row) return { ok: false, error: "lobby_not_found" };

  const players = parseJson(row.players_json, []);
  if (players.length < 2) return { ok: false, error: "not_enough_players" };

  const matchId = `match_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const state = {
    tick: 0,
    timestamp: Date.now(),
    entities: {},
    events: [],
    players,
  };

  await env.DB.prepare(
    `INSERT INTO game_matches (id, project_id, lobby_id, status, state_json, started_at)
     VALUES (?, ?, ?, 'playing', ?, ?)`,
  )
    .bind(matchId, auth.projectId, lobbyId, JSON.stringify(state), now)
    .run();

  await env.DB.prepare(
    `UPDATE game_lobbies SET state = 'in_game', updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(now, lobbyId, auth.projectId)
    .run();

  if (row.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: row.room_id,
      name: "game.match_started",
      userId: row.host_id,
      data: { matchId, lobbyId, players, state },
    }).catch(() => {});
  }

  return { ok: true, match: rowToMatch({ id: matchId, lobby_id: lobbyId, status: "playing", state_json: JSON.stringify(state), started_at: now, result_json: null, ended_at: null }) };
}

export async function getGameMatch(env, auth, matchId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_matches WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, matchId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, match: rowToMatch(row) };
}

export async function submitGameInput(env, auth, matchId, input) {
  const current = await getGameMatch(env, auth, matchId);
  if (!current.ok) return current;

  const state = current.match.state;
  state.tick = Number(state.tick ?? 0) + 1;
  state.timestamp = Date.now();
  state.events = Array.isArray(state.events) ? state.events : [];
  state.events.push({
    id: `evt_${state.tick}`,
    type: "input",
    tick: state.tick,
    playerId: String(input.playerId ?? auth.userId),
    data: input.actions ?? input,
  });

  await env.DB.prepare(
    `UPDATE game_matches SET state_json = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(state), matchId, auth.projectId)
    .run();

  const lobbyRow = current.match.lobbyId
    ? await env.DB.prepare(
        `SELECT room_id FROM game_lobbies WHERE project_id = ? AND id = ?`,
      )
        .bind(auth.projectId, current.match.lobbyId)
        .first()
    : null;

  if (lobbyRow?.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: lobbyRow.room_id,
      name: "game.tick",
      userId: String(input.playerId ?? auth.userId),
      data: { matchId, tick: state.tick, events: state.events.slice(-1) },
    }).catch(() => {});
  }

  return { ok: true, match: { ...current.match, state } };
}

export async function endGameMatch(env, auth, matchId, result) {
  const now = nowIso();
  const update = await env.DB.prepare(
    `UPDATE game_matches SET status = 'ended', result_json = ?, ended_at = ? WHERE project_id = ? AND id = ?`,
  )
    .bind(result ? JSON.stringify(result) : null, now, auth.projectId, matchId)
    .run();
  if (!update.meta?.changes) return { ok: false, error: "not_found" };
  return getGameMatch(env, auth, matchId);
}
