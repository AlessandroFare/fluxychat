/**
 * D1-backed tournament brackets for FluxyGame.
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToTournament(row) {
  const bracket = parseJson(row.bracket_json, { players: [], rounds: [] });
  return {
    id: row.id,
    name: row.name,
    prize: row.prize ?? "",
    maxPlayers: Number(row.max_players),
    currentPlayers: Array.isArray(bracket.players) ? bracket.players.length : 0,
    status: row.status === "in_progress" ? "active" : row.status === "completed" ? "completed" : "registration",
    rounds: Array.isArray(bracket.rounds) ? bracket.rounds : [],
    roomId: row.room_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createGameTournament(env, auth, input) {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const prize = input.prize ? String(input.prize).trim().slice(0, 200) : "";
  const maxPlayers = Math.min(Math.max(Number(input.maxPlayers) || 8, 2), 64);
  const roomId = input.roomId ? String(input.roomId).trim().slice(0, 128) : null;
  const players = Array.isArray(input.players) ? input.players.map(String).slice(0, maxPlayers) : [];

  if (!name) return { ok: false, error: "name_required" };

  const id = `tourney_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();
  const bracket = { players, rounds: [] };

  await env.DB.prepare(
    `INSERT INTO game_tournaments
     (id, project_id, room_id, name, prize, max_players, status, bracket_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'registration', ?, ?, ?, ?)`,
  )
    .bind(id, auth.projectId, roomId, name, prize, maxPlayers, JSON.stringify(bracket), auth.userId, now, now)
    .run();

  return { ok: true, tournament: rowToTournament({
    id, project_id: auth.projectId, room_id: roomId, name, prize,
    max_players: maxPlayers, status: "registration", bracket_json: JSON.stringify(bracket),
    created_at: now, updated_at: now,
  }) };
}

export async function listGameTournaments(env, auth, filter = {}) {
  let sql = "SELECT * FROM game_tournaments WHERE project_id = ?";
  const params = [auth.projectId];
  if (filter.status) {
    sql += " AND status = ?";
    params.push(filter.status === "active" ? "in_progress" : filter.status);
  }
  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(Math.min(Number(filter.limit) || 25, 50));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return { ok: true, tournaments: (rows.results || []).map(rowToTournament) };
}

export async function getGameTournament(env, auth, tournamentId) {
  const row = await env.DB.prepare(
    "SELECT * FROM game_tournaments WHERE project_id = ? AND id = ?",
  ).bind(auth.projectId, tournamentId).first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, tournament: rowToTournament(row) };
}

export async function registerTournamentPlayers(env, auth, tournamentId, players) {
  const row = await env.DB.prepare(
    "SELECT * FROM game_tournaments WHERE project_id = ? AND id = ?",
  ).bind(auth.projectId, tournamentId).first();
  if (!row) return { ok: false, error: "not_found" };

  const list = Array.isArray(players) ? players.map(String) : [];
  if (!list.length) return { ok: false, error: "players_required" };

  const bracket = parseJson(row.bracket_json, { players: [], rounds: [] });
  const merged = [...new Set([...(bracket.players || []), ...list])].slice(0, Number(row.max_players));
  bracket.players = merged;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE game_tournaments SET bracket_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
  ).bind(JSON.stringify(bracket), now, tournamentId, auth.projectId).run();

  return getGameTournament(env, auth, tournamentId);
}

export async function startGameTournament(env, auth, tournamentId, input = {}) {
  const row = await env.DB.prepare(
    "SELECT * FROM game_tournaments WHERE project_id = ? AND id = ?",
  ).bind(auth.projectId, tournamentId).first();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "registration") return { ok: false, error: "invalid_status" };

  const existingBracket = parseJson(row.bracket_json, { players: [], rounds: [] });
  const players = Array.isArray(input.players) && input.players.length
    ? input.players.map(String)
    : (existingBracket.players || []);

  if (players.length < 2) return { ok: false, error: "not_enough_players" };

  const numMatches = Math.floor(players.length / 2);
  const round = {
    round: 1,
    matches: Array.from({ length: numMatches }, (_, i) => ({
      id: `tm_${tournamentId}_r1_${i}`,
      player1: players[i * 2],
      player2: players[i * 2 + 1],
      winner: null,
    })),
  };

  const bracket = { players, rounds: [round] };
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE game_tournaments SET status = 'in_progress', bracket_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
  ).bind(JSON.stringify(bracket), now, tournamentId, auth.projectId).run();

  const updated = await getGameTournament(env, auth, tournamentId);
  if (updated.ok && row.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: row.room_id,
      name: "game.tournament_started",
      userId: auth.userId,
      data: { tournamentId, tournament: updated.tournament },
    }).catch(() => {});
  }
  return updated;
}

export async function reportTournamentMatch(env, auth, tournamentId, matchId, winner) {
  const row = await env.DB.prepare(
    "SELECT * FROM game_tournaments WHERE project_id = ? AND id = ?",
  ).bind(auth.projectId, tournamentId).first();
  if (!row) return { ok: false, error: "not_found" };

  const bracket = parseJson(row.bracket_json, { players: [], rounds: [] });
  let found = false;

  for (const round of bracket.rounds || []) {
    const match = round.matches?.find((m) => m.id === matchId);
    if (!match) continue;
    match.winner = String(winner);
    found = true;

    if (round.matches.every((m) => m.winner)) {
      if (round.matches.length === 1) {
        await env.DB.prepare(
          "UPDATE game_tournaments SET status = 'completed', bracket_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
        ).bind(JSON.stringify(bracket), new Date().toISOString(), tournamentId, auth.projectId).run();
      } else {
        const winners = round.matches.map((m) => m.winner);
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (winners[i + 1]) {
            nextMatches.push({
              id: `tm_${tournamentId}_r${round.round + 1}_${i / 2}`,
              player1: winners[i],
              player2: winners[i + 1],
              winner: null,
            });
          }
        }
        bracket.rounds.push({ round: round.round + 1, matches: nextMatches });
        await env.DB.prepare(
          "UPDATE game_tournaments SET bracket_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
        ).bind(JSON.stringify(bracket), new Date().toISOString(), tournamentId, auth.projectId).run();
      }
    } else {
      await env.DB.prepare(
        "UPDATE game_tournaments SET bracket_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
      ).bind(JSON.stringify(bracket), new Date().toISOString(), tournamentId, auth.projectId).run();
    }
    break;
  }

  if (!found) return { ok: false, error: "match_not_found" };
  return getGameTournament(env, auth, tournamentId);
}
