import { describe, expect, it } from "vitest";
import { findOrCreateLobby, startGameMatch, submitGameInput } from "./fluxy-game.js";

function mockDb() {
  const lobbies = new Map();
  const matches = new Map();

  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (sql.includes("INSERT INTO game_lobbies")) {
                lobbies.set(params[0], {
                  id: params[0],
                  project_id: params[1],
                  room_id: params[2],
                  game_mode: params[3],
                  max_players: params[4],
                  host_id: params[5],
                  state: "waiting",
                  players_json: params[6],
                  updated_at: params[8],
                });
              }
              if (sql.includes("UPDATE game_lobbies SET players_json")) {
                const lobby = lobbies.get(params[2]);
                if (lobby) {
                  lobby.players_json = params[0];
                  lobby.updated_at = params[1];
                }
              }
              if (sql.includes("INSERT INTO game_matches")) {
                matches.set(params[0], {
                  id: params[0],
                  project_id: params[1],
                  lobby_id: params[2],
                  status: params[3],
                  state_json: params[4],
                  started_at: params[5],
                  result_json: null,
                  ended_at: null,
                });
              }
              if (sql.includes("UPDATE game_matches SET state_json")) {
                const match = matches.get(params[1]);
                if (match) match.state_json = params[0];
              }
              if (sql.includes("UPDATE game_lobbies SET state = 'in_game'")) {
                const lobby = lobbies.get(params[1]);
                if (lobby) lobby.state = "in_game";
              }
            },
            async first() {
              if (sql.includes("FROM game_lobbies") && sql.includes("AND id = ?")) {
                return lobbies.get(params[1]) ?? null;
              }
              if (sql.includes("FROM game_matches")) {
                return matches.get(params[1]) ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM game_lobbies")) {
                return {
                  results: Array.from(lobbies.values()).filter(
                    (l) => l.project_id === params[0] && l.game_mode === params[1] && l.state === "waiting",
                  ),
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe("fluxy-game", () => {
  it("starts match from lobby with two players", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    const first = await findOrCreateLobby(env, auth, { playerId: "alice" });
    const second = await findOrCreateLobby(env, { ...auth, userId: "bob" }, { playerId: "bob", gameMode: "deathmatch" });
    const started = await startGameMatch(env, auth, second.lobby.id);
    expect(started.ok).toBe(true);
    const input = await submitGameInput(env, auth, started.match.id, { playerId: "alice", actions: [{ type: "move" }] });
    expect(input.ok).toBe(true);
    expect(input.match.state.tick).toBeGreaterThan(0);
  });
});
