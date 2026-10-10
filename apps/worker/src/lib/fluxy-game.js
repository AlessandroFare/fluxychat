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

async function fanoutLobbyUpdated(env, auth, lobby, action, playerId) {
  if (!lobby?.roomId) return;
  await fanoutServerEvent(env, {
    projectId: auth.projectId,
    roomId: lobby.roomId,
    name: "game.lobby_updated",
    userId: playerId,
    data: {
      lobbyId: lobby.id,
      players: lobby.players,
      state: lobby.state,
      hostId: lobby.hostId,
      action,
    },
  }).catch(() => {});
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

function mapLeaderboardRow(row, rank) {
  return {
    rank,
    playerId: row.player_id,
    username: row.username,
    skillRating: Number(row.skill_rating),
    region: row.region,
    stats: parseJson(row.stats_json, {}),
    updatedAt: row.updated_at,
  };
}

export async function listGameLeaderboard(env, auth, limit = 20, aroundPlayerId) {
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const rows = await env.DB.prepare(
    `SELECT player_id, username, skill_rating, region, stats_json, updated_at
     FROM game_player_profiles
     WHERE project_id = ?
     ORDER BY skill_rating DESC, updated_at DESC
     LIMIT ?`,
  )
    .bind(auth.projectId, cap)
    .all();

  const leaderboard = (rows.results || []).map((row, i) => mapLeaderboardRow(row, i + 1));
  const around = aroundPlayerId ? String(aroundPlayerId).trim() : "";
  if (!around) return { ok: true, leaderboard };

  const idx = leaderboard.findIndex((row) => row.playerId === around);
  if (idx >= 0) {
    const window = 2;
    const start = Math.max(0, idx - window);
    return { ok: true, around, leaderboard: leaderboard.slice(start, idx + window + 1) };
  }

  const own = await env.DB.prepare(
    `SELECT player_id, username, skill_rating, region, stats_json, updated_at
     FROM game_player_profiles WHERE project_id = ? AND player_id = ?`,
  )
    .bind(auth.projectId, around)
    .first();
  if (!own) return { ok: true, around, leaderboard };

  const ahead = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM game_player_profiles
     WHERE project_id = ? AND (skill_rating > ? OR (skill_rating = ? AND updated_at > ?))`,
  )
    .bind(auth.projectId, Number(own.skill_rating), Number(own.skill_rating), own.updated_at)
    .first();
  const rank = Number(ahead?.n || 0) + 1;
  return { ok: true, around, leaderboard: [mapLeaderboardRow(own, rank)] };
}

export async function listGameLobbies(env, auth, filter = {}) {
  const state = filter.state ? String(filter.state).slice(0, 32) : "";
  const gameMode = filter.gameMode ? String(filter.gameMode).slice(0, 32) : "";
  let sql = `SELECT * FROM game_lobbies WHERE project_id = ?`;
  const params = [auth.projectId];
  if (gameMode) {
    sql += ` AND game_mode = ?`;
    params.push(gameMode);
  }
  if (state) {
    sql += ` AND state = ?`;
    params.push(state);
  }
  sql += ` ORDER BY updated_at DESC LIMIT 50`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return { ok: true, lobbies: (rows.results || []).map(rowToLobby) };
}

function rowToParty(row) {
  return {
    id: row.id,
    roomId: row.room_id || undefined,
    leaderId: row.leader_id,
    maxMembers: Number(row.max_members),
    members: parseJson(row.members_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createGameParty(env, auth, input = {}) {
  const leaderId = String(input.leaderId ?? auth.userId).trim();
  if (!leaderId) return { ok: false, error: "leader_required" };
  const id = `party_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const maxMembers = Math.min(Math.max(Number(input.maxMembers) || 4, 2), 16);
  const roomId = input.roomId?.trim() || undefined;
  await env.DB.prepare(
    `INSERT INTO game_parties
     (id, project_id, room_id, leader_id, max_members, members_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, auth.projectId, roomId ?? null, leaderId, maxMembers, JSON.stringify([leaderId]), now, now)
    .run();
  const party = { id, roomId, leaderId, maxMembers, members: [leaderId], createdAt: now, updatedAt: now };
  if (roomId) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId,
      name: "game.party_updated",
      userId: leaderId,
      data: { partyId: id, members: party.members, action: "create" },
    }).catch(() => {});
  }
  return { ok: true, party };
}

export async function listGameParties(env, auth) {
  const rows = await env.DB.prepare(
    `SELECT * FROM game_parties WHERE project_id = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(auth.projectId)
    .all();
  return { ok: true, parties: (rows.results || []).map(rowToParty) };
}

export async function getGameParty(env, auth, partyId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_parties WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, partyId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, party: rowToParty(row) };
}

export async function joinGameParty(env, auth, partyId, playerId) {
  const current = await getGameParty(env, auth, partyId);
  if (!current.ok) return current;
  const pid = String(playerId ?? auth.userId).trim();
  const members = current.party.members;
  if (members.includes(pid)) return current;
  if (members.length >= current.party.maxMembers) return { ok: false, error: "party_full" };
  members.push(pid);
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE game_parties SET members_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(members), now, partyId, auth.projectId)
    .run();
  if (current.party.roomId) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: current.party.roomId,
      name: "game.party_updated",
      userId: pid,
      data: { partyId, members, action: "join" },
    }).catch(() => {});
  }
  return { ok: true, party: { ...current.party, members, updatedAt: now } };
}

export async function leaveGameParty(env, auth, partyId, playerId) {
  const current = await getGameParty(env, auth, partyId);
  if (!current.ok) return current;
  const pid = String(playerId ?? auth.userId).trim();
  const members = current.party.members.filter((id) => id !== pid);
  if (members.length === current.party.members.length) return { ok: false, error: "not_in_party" };
  const now = nowIso();
  const leaderId = current.party.leaderId === pid ? members[0] || pid : current.party.leaderId;
  await env.DB.prepare(
    `UPDATE game_parties SET members_json = ?, leader_id = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(members), leaderId, now, partyId, auth.projectId)
    .run();
  if (current.party.roomId) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: current.party.roomId,
      name: "game.party_updated",
      userId: pid,
      data: { partyId, members, action: "leave" },
    }).catch(() => {});
  }
  return { ok: true, party: { ...current.party, members, leaderId, updatedAt: now } };
}

export async function findOrCreateLobby(env, auth, input = {}) {
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
    if (players.includes(playerId)) {
      return { ok: true, lobby: rowToLobby(row) };
    }
    if (players.length >= Number(row.max_players)) continue;
    players.push(playerId);
    const now = nowIso();
    await env.DB.prepare(
      `UPDATE game_lobbies SET players_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(JSON.stringify(players), now, row.id, auth.projectId)
      .run();
    const lobby = { ...rowToLobby(row), players };
    await fanoutLobbyUpdated(env, auth, lobby, "join", playerId);
    return { ok: true, lobby };
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

  const created = {
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
  await fanoutLobbyUpdated(env, auth, created.lobby, "create", playerId);
  return created;
}

/** Colyseus `matchMaker.joinById`. */
export async function joinGameLobby(env, auth, lobbyId, playerId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_lobbies WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, lobbyId)
    .first();
  if (!row) return { ok: false, error: "lobby_not_found" };
  if (row.state !== "waiting") return { ok: false, error: "lobby_not_waiting" };

  const pid = String(playerId ?? auth.userId).trim();
  if (!pid) return { ok: false, error: "player_required" };
  const players = parseJson(row.players_json, []);
  if (players.includes(pid)) return { ok: true, lobby: rowToLobby(row) };
  if (players.length >= Number(row.max_players)) return { ok: false, error: "lobby_full" };

  players.push(pid);
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE game_lobbies SET players_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(players), now, row.id, auth.projectId)
    .run();
  const lobby = { ...rowToLobby(row), players, updatedAt: now };
  await fanoutLobbyUpdated(env, auth, lobby, "join", pid);
  return { ok: true, lobby };
}

export async function leaveGameLobby(env, auth, lobbyId, playerId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_lobbies WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, lobbyId)
    .first();
  if (!row) return { ok: false, error: "lobby_not_found" };
  if (row.state !== "waiting") return { ok: false, error: "lobby_not_waiting" };

  const pid = String(playerId ?? auth.userId).trim();
  const players = parseJson(row.players_json, []).filter((id) => id !== pid);
  if (players.length === parseJson(row.players_json, []).length) {
    return { ok: false, error: "not_in_lobby" };
  }

  const now = nowIso();
  const hostId = row.host_id === pid ? players[0] || row.host_id : row.host_id;
  const nextState = players.length === 0 ? "post_game" : row.state;
  await env.DB.prepare(
    `UPDATE game_lobbies SET players_json = ?, host_id = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(players), hostId, now, row.id, auth.projectId)
    .run();

  if (players.length === 0) {
    await env.DB.prepare(
      `UPDATE game_lobbies SET state = 'post_game', updated_at = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(now, row.id, auth.projectId)
      .run();
  }

  const lobby = {
    ...rowToLobby(row),
    players,
    hostId,
    state: nextState,
    updatedAt: now,
  };
  await fanoutLobbyUpdated(env, auth, lobby, "leave", pid);
  return { ok: true, lobby };
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

export async function listGameMatches(env, auth, filter = {}) {
  const status = filter.status ? String(filter.status).slice(0, 32) : "";
  let sql = `SELECT * FROM game_matches WHERE project_id = ?`;
  const params = [auth.projectId];
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY started_at DESC LIMIT 50`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    ok: true,
    matches: (rows.results || []).map((row) => {
      const match = rowToMatch(row);
      const players = Array.isArray(match.state?.players) ? match.state.players : [];
      return {
        id: match.id,
        lobbyId: match.lobbyId,
        status: match.status,
        size: players.length,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
      };
    }),
  };
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
  if (current.match.status !== "playing") return { ok: false, error: "match_not_playing" };

  const playerId = String(input.playerId ?? auth.userId);
  const roster = current.match.state?.players;
  if (Array.isArray(roster) && roster.length && !roster.includes(playerId)) {
    return { ok: false, error: "not_in_match" };
  }

  const state = current.match.state;
  state.tick = Number(state.tick ?? 0) + 1;
  state.timestamp = Date.now();
  state.events = Array.isArray(state.events) ? state.events : [];
  state.events.push({
    id: `evt_${state.tick}`,
    type: "input",
    tick: state.tick,
    playerId,
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
      userId: playerId,
      data: { matchId, tick: state.tick, state, events: state.events.slice(-1) },
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

  const ended = await getGameMatch(env, auth, matchId);
  const lobbyId = ended.ok ? ended.match.lobbyId : null;
  const lobbyRow = lobbyId
    ? await env.DB.prepare(
        `SELECT room_id FROM game_lobbies WHERE project_id = ? AND id = ?`,
      )
        .bind(auth.projectId, lobbyId)
        .first()
    : null;
  if (lobbyRow?.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: lobbyRow.room_id,
      name: "game.match_ended",
      userId: auth.userId,
      data: { matchId, lobbyId, result: result ?? null },
    }).catch(() => {});
  }

  const winnerId = result?.winnerId || result?.winner;
  if (winnerId) {
    await env.DB.prepare(
      `UPDATE game_player_profiles
       SET skill_rating = skill_rating + 16, updated_at = ?
       WHERE project_id = ? AND player_id = ?`,
    )
      .bind(now, auth.projectId, String(winnerId))
      .run();
  }

  return getGameMatch(env, auth, matchId);
}
