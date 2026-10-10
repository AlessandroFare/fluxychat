import { describe, expect, it } from "vitest";
import {
  createGameParty,
  findOrCreateLobby,
  joinGameParty,
  joinGameLobby,
  listGameMatches,
  listGameParties,
  leaveGameLobby,
  leaveGameParty,
  listGameLobbies,
  startGameMatch,
  submitGameInput,
} from "./fluxy-game.js";

function mockDb() {
  const lobbies = new Map();
  const matches = new Map();
  const parties = new Map();

  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (sql.includes("INSERT INTO game_parties")) {
                parties.set(params[0], {
                  id: params[0],
                  project_id: params[1],
                  room_id: params[2],
                  leader_id: params[3],
                  max_members: params[4],
                  members_json: params[5],
                  created_at: params[6],
                  updated_at: params[7],
                });
              }
              if (sql.includes("UPDATE game_parties SET members_json = ?, leader_id")) {
                const party = parties.get(params[3]);
                if (party) {
                  party.members_json = params[0];
                  party.leader_id = params[1];
                  party.updated_at = params[2];
                }
              } else if (sql.includes("UPDATE game_parties SET members_json")) {
                const party = parties.get(params[2]);
                if (party) {
                  party.members_json = params[0];
                  party.updated_at = params[1];
                }
              }
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
                const idIndex = sql.includes("host_id") ? 3 : 2;
                const lobby = lobbies.get(params[idIndex]);
                if (lobby) {
                  lobby.players_json = params[0];
                  if (sql.includes("host_id")) {
                    lobby.host_id = params[1];
                    lobby.updated_at = params[2];
                  } else {
                    lobby.updated_at = params[1];
                  }
                }
              }
              if (sql.includes("INSERT INTO game_matches")) {
                matches.set(params[0], {
                  id: params[0],
                  project_id: params[1],
                  lobby_id: params[2],
                  status: "playing",
                  state_json: params[3],
                  started_at: params[4],
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
              if (sql.includes("UPDATE game_lobbies SET state = 'post_game'")) {
                const lobby = lobbies.get(params[1]);
                if (lobby) lobby.state = "post_game";
              }
              if (sql.includes("UPDATE game_matches SET status = 'ended'")) {
                const match = matches.get(params[3]);
                if (match) {
                  match.status = "ended";
                  match.result_json = params[0];
                  match.ended_at = params[1];
                }
              }
              return { meta: { changes: 1 } };
            },
            async first() {
              if (sql.includes("FROM game_parties") && sql.includes("AND id = ?")) {
                return parties.get(params[1]) ?? null;
              }
              if (sql.includes("FROM game_lobbies") && sql.includes("AND id = ?")) {
                return lobbies.get(params[1]) ?? null;
              }
              if (sql.includes("FROM game_matches")) {
                return matches.get(params[1]) ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM game_parties")) {
                return {
                  results: Array.from(parties.values()).filter((p) => p.project_id === params[0]),
                };
              }
              if (sql.includes("FROM game_matches")) {
                let results = Array.from(matches.values()).filter((m) => m.project_id === params[0]);
                if (sql.includes("AND status = ?")) {
                  results = results.filter((m) => m.status === params[1]);
                }
                return { results };
              }
              if (sql.includes("FROM game_lobbies")) {
                let results = Array.from(lobbies.values()).filter((l) => l.project_id === params[0]);
                if (sql.includes("AND game_mode = ?")) {
                  results = results.filter((l) => l.game_mode === params[1]);
                }
                if (sql.includes("state = 'waiting'") || sql.includes("AND state = ?")) {
                  const want = sql.includes("AND state = ?")
                    ? params[sql.includes("AND game_mode = ?") ? 2 : 1]
                    : "waiting";
                  results = results.filter((l) => l.state === want);
                }
                return { results };
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

  it("does not double-join the same playerId", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    const first = await findOrCreateLobby(env, auth, { playerId: "alice" });
    const again = await findOrCreateLobby(env, auth, { playerId: "alice" });
    expect(again.lobby.id).toBe(first.lobby.id);
    expect(again.lobby.players).toEqual(["alice"]);
  });

  it("leaves a waiting lobby", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    const first = await findOrCreateLobby(env, auth, { playerId: "alice" });
    await findOrCreateLobby(env, { ...auth, userId: "bob" }, { playerId: "bob" });
    const left = await leaveGameLobby(env, auth, first.lobby.id, "alice");
    expect(left.ok).toBe(true);
    expect(left.lobby.players).toEqual(["bob"]);
    expect(left.lobby.hostId).toBe("bob");
  });

  it("joins a waiting lobby by id", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    const first = await findOrCreateLobby(env, auth, { playerId: "alice", maxPlayers: 4 });
    const joined = await joinGameLobby(env, { ...auth, userId: "cara" }, first.lobby.id, "cara");
    expect(joined.ok).toBe(true);
    expect(joined.lobby.players).toEqual(["alice", "cara"]);
  });

  it("rejects input after the match is no longer playing", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    await findOrCreateLobby(env, auth, { playerId: "alice" });
    const second = await findOrCreateLobby(env, { ...auth, userId: "bob" }, { playerId: "bob" });
    const started = await startGameMatch(env, auth, second.lobby.id);
    const ended = await env.DB.prepare(
      `UPDATE game_matches SET status = 'ended', result_json = ?, ended_at = ? WHERE project_id = ? AND id = ?`,
    )
      .bind(null, "now", "p1", started.match.id)
      .run();
    expect(ended).toBeTruthy();
    const input = await submitGameInput(env, auth, started.match.id, { playerId: "alice", actions: { move: "nudge" } });
    expect(input.ok).toBe(false);
    expect(input.error).toBe("match_not_playing");
  });

  it("lists waiting lobbies", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    await findOrCreateLobby(env, auth, { playerId: "alice" });
    const listed = await listGameLobbies(env, auth, { state: "waiting" });
    expect(listed.lobbies).toHaveLength(1);
    expect(listed.lobbies[0].players).toEqual(["alice"]);
  });

  it("creates and joins a party", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    const created = await createGameParty(env, auth, { leaderId: "alice", roomId: "room-1" });
    expect(created.ok).toBe(true);
    const joined = await joinGameParty(env, auth, created.party.id, "bob");
    expect(joined.party.members).toEqual(["alice", "bob"]);
    const left = await leaveGameParty(env, auth, created.party.id, "bob");
    expect(left.party.members).toEqual(["alice"]);
  });

  it("lists parties and live matches", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "alice" };
    await createGameParty(env, auth, { leaderId: "alice" });
    const parties = await listGameParties(env, auth);
    expect(parties.parties).toHaveLength(1);
    await findOrCreateLobby(env, auth, { playerId: "alice" });
    const second = await findOrCreateLobby(env, { ...auth, userId: "bob" }, { playerId: "bob" });
    await startGameMatch(env, auth, second.lobby.id);
    const listed = await listGameMatches(env, auth, { status: "playing" });
    expect(listed.matches).toHaveLength(1);
    expect(listed.matches[0].size).toBe(2);
  });
});
