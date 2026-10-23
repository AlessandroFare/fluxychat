/**
 * Game route happy paths + status mapping.
 * The game libs are unit-tested on their own fake D1 (`fluxy-game.test.js`,
 * `game-checkpoint.test.js`, …) — this file locks the HTTP layer: dispatch,
 * auth, arg mapping and error → status codes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchFluxyGameRoutes } from "./fluxy-game-http.js";
import * as game from "../lib/fluxy-game.js";
import * as checkpoints from "../lib/game-checkpoint.js";
import * as crdt from "../lib/yjs-game-checkpoint.js";
import * as quests from "../lib/game-quest.js";
import * as tournaments from "../lib/game-tournament.js";
import * as npcs from "../lib/game-npc.js";

vi.mock("../lib/fluxy-game.js", () => ({
  createGameParty: vi.fn(),
  endGameMatch: vi.fn(),
  findOrCreateLobby: vi.fn(),
  getGameMatch: vi.fn(),
  listGameMatches: vi.fn(),
  getGameParty: vi.fn(),
  listGameParties: vi.fn(),
  joinGameParty: vi.fn(),
  joinGameLobby: vi.fn(),
  leaveGameLobby: vi.fn(),
  leaveGameParty: vi.fn(),
  listGameLeaderboard: vi.fn(),
  listGameLobbies: vi.fn(),
  startGameMatch: vi.fn(),
  submitGameInput: vi.fn(),
  upsertGamePlayer: vi.fn(),
}));
vi.mock("../lib/game-checkpoint.js", () => ({
  getGameCheckpoint: vi.fn(),
  getGameCheckpointMerged: vi.fn(),
  listGameCheckpoints: vi.fn(),
  listGameCheckpointsMerged: vi.fn(),
  upsertGameCheckpoint: vi.fn(),
  deleteGameCheckpoint: vi.fn(),
  federateGameCheckpoint: vi.fn(),
  ingestFederatedCheckpoint: vi.fn(),
  verifyFederationSecret: vi.fn(),
}));
vi.mock("../lib/yjs-game-checkpoint.js", () => ({
  fetchGameCheckpointCrdtSnapshot: vi.fn(),
}));
vi.mock("../lib/game-quest.js", () => ({
  createGameQuest: vi.fn(),
  listGameQuests: vi.fn(),
  moderateGameQuest: vi.fn(),
  updateGameQuestProgress: vi.fn(),
}));
vi.mock("../lib/game-tournament.js", () => ({
  createGameTournament: vi.fn(),
  getGameTournament: vi.fn(),
  listGameTournaments: vi.fn(),
  reportTournamentMatch: vi.fn(),
  startGameTournament: vi.fn(),
  registerTournamentPlayers: vi.fn(),
}));
vi.mock("../lib/game-npc.js", () => ({
  interactGameNpc: vi.fn(),
  listGameNpcs: vi.fn(),
  upsertGameNpc: vi.fn(),
}));

const auth = { userId: "u1", projectId: "p1", roles: ["member"] };

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => auth,
    ...overrides,
  });
}

function request(path, { method = "GET", body, headers } = {}, h) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchFluxyGameRoutes(req, new URL(req.url), h);
}

describe("fluxy game routes — dispatch & auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-game paths and unknown game routes", async () => {
    expect(await request("/rooms/room_1", {}, deps())).toBeNull();
    expect(await request("/games/unknown", {}, deps())).toBeNull();
    expect(await request("/games/players", { method: "DELETE" }, deps())).toBeNull();
  });

  it("401s without a JWT", async () => {
    const res = await request("/games/players", { method: "PUT", body: {} }, createAuthMatrixDeps());
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");
  });
});

describe("fluxy game routes — players & leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /games/players upserts and passes errors through as 400", async () => {
    game.upsertGamePlayer.mockResolvedValueOnce({ ok: true, player: { id: "p1" } });
    const ok = await request("/games/players", { method: "PUT", body: { playerId: "p1" } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).player.id).toBe("p1");
    expect(game.upsertGamePlayer).toHaveBeenCalledWith(
      expect.objectContaining({ DB: null }),
      auth,
      { playerId: "p1" },
    );

    game.upsertGamePlayer.mockResolvedValueOnce({ ok: false, error: "player_id_required" });
    const bad = await request("/games/players", { method: "PUT", body: {} }, deps());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("player_id_required");
  });

  it("GET /games/leaderboard maps limit and around", async () => {
    game.listGameLeaderboard.mockResolvedValueOnce({ ok: true, leaderboard: [{ playerId: "p1", rank: 1 }] });
    const res = await request("/games/leaderboard?limit=5&around=p1", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).leaderboard).toHaveLength(1);
    expect(game.listGameLeaderboard).toHaveBeenCalledWith(expect.anything(), auth, "5", "p1");
  });
});

describe("fluxy game routes — parties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /games/parties creates a party", async () => {
    game.createGameParty.mockResolvedValueOnce({ ok: true, party: { id: "party_1", members: ["u1"] } });
    const res = await request("/games/parties", { method: "POST", body: { roomId: "room_1" } }, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).party.id).toBe("party_1");
  });

  it("POST /games/parties maps errors to 400", async () => {
    game.createGameParty.mockResolvedValueOnce({ ok: false, error: "leader_required" });
    const res = await request("/games/parties", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("leader_required");
  });

  it("GET /games/parties lists parties", async () => {
    game.listGameParties.mockResolvedValueOnce({ ok: true, parties: [{ id: "party_1" }] });
    const res = await request("/games/parties", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).parties).toHaveLength(1);
  });

  it("GET /games/parties/:id 404s on not_found", async () => {
    game.getGameParty.mockResolvedValueOnce({ ok: false, error: "not_found" });
    const res = await request("/games/parties/party_x", {}, deps());
    expect(res.status).toBe(404);
    expect(game.getGameParty).toHaveBeenCalledWith(expect.anything(), auth, "party_x");
  });

  it("POST /games/parties/:id/join maps not_found → 404, other → 400", async () => {
    game.joinGameParty.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/parties/p1/join", { method: "POST", body: {} }, deps())).status).toBe(404);

    game.joinGameParty.mockResolvedValueOnce({ ok: false, error: "party_full" });
    expect((await request("/games/parties/p1/join", { method: "POST", body: {} }, deps())).status).toBe(400);

    game.joinGameParty.mockResolvedValueOnce({ ok: true, party: { id: "p1", members: ["u1", "u2"] } });
    const ok = await request("/games/parties/p1/join", { method: "POST", body: { playerId: "u2" } }, deps());
    expect(ok.status).toBe(200);
    expect(game.joinGameParty).toHaveBeenCalledWith(expect.anything(), auth, "p1", "u2");
  });

  it("POST /games/parties/:id/leave maps not_found → 404", async () => {
    game.leaveGameParty.mockResolvedValueOnce({ ok: false, error: "not_found" });
    const res = await request("/games/parties/p1/leave", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(404);
  });
});

describe("fluxy game routes — lobbies & matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /games/lobbies passes filters", async () => {
    game.listGameLobbies.mockResolvedValueOnce({ ok: true, lobbies: [] });
    const res = await request("/games/lobbies?gameMode=deathmatch&state=waiting", {}, deps());
    expect(res.status).toBe(200);
    expect(game.listGameLobbies).toHaveBeenCalledWith(expect.anything(), auth, {
      gameMode: "deathmatch",
      state: "waiting",
    });
  });

  it("POST /games/lobbies/matchmake returns the lobby", async () => {
    game.findOrCreateLobby.mockResolvedValueOnce({ ok: true, lobby: { id: "lobby_1", players: ["u1"] } });
    const res = await request("/games/lobbies/matchmake", { method: "POST", body: { playerId: "u1" } }, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).lobby.id).toBe("lobby_1");
  });

  it("POST /games/lobbies/:id/join maps lobby_not_found → 404", async () => {
    game.joinGameLobby.mockResolvedValueOnce({ ok: false, error: "lobby_not_found" });
    expect((await request("/games/lobbies/l1/join", { method: "POST", body: {} }, deps())).status).toBe(404);

    game.joinGameLobby.mockResolvedValueOnce({ ok: false, error: "lobby_full" });
    expect((await request("/games/lobbies/l1/join", { method: "POST", body: {} }, deps())).status).toBe(400);
  });

  it("POST /games/lobbies/:id/leave maps lobby_not_found → 404", async () => {
    game.leaveGameLobby.mockResolvedValueOnce({ ok: false, error: "lobby_not_found" });
    const res = await request("/games/lobbies/l1/leave", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(404);
  });

  it("POST /games/lobbies/:id/start starts the match", async () => {
    game.startGameMatch.mockResolvedValueOnce({ ok: true, match: { id: "match_1" } });
    const res = await request("/games/lobbies/l1/start", { method: "POST" }, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).match.id).toBe("match_1");
    expect(game.startGameMatch).toHaveBeenCalledWith(expect.anything(), auth, "l1");
  });

  it("GET /games/matches passes the status filter", async () => {
    game.listGameMatches.mockResolvedValueOnce({ ok: true, matches: [{ id: "m1", status: "playing" }] });
    const res = await request("/games/matches?status=playing", {}, deps());
    expect(res.status).toBe(200);
    expect(game.listGameMatches).toHaveBeenCalledWith(expect.anything(), auth, { status: "playing" });
  });

  it("GET /games/matches/:id 404s on not_found", async () => {
    game.getGameMatch.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/matches/m1", {}, deps())).status).toBe(404);

    game.getGameMatch.mockResolvedValueOnce({ ok: true, match: { id: "m1", status: "playing" } });
    expect((await request("/games/matches/m1", {}, deps())).status).toBe(200);
  });

  it("POST /games/matches/:id/input maps not_found → 404, other → 400", async () => {
    game.submitGameInput.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/matches/m1/input", { method: "POST", body: {} }, deps())).status).toBe(404);

    game.submitGameInput.mockResolvedValueOnce({ ok: false, error: "match_not_playing" });
    expect((await request("/games/matches/m1/input", { method: "POST", body: {} }, deps())).status).toBe(400);

    game.submitGameInput.mockResolvedValueOnce({ ok: true, match: { id: "m1", state: { tick: 3 } } });
    const ok = await request("/games/matches/m1/input", { method: "POST", body: { playerId: "u1" } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).match.state.tick).toBe(3);
  });

  it("POST /games/matches/:id/end 404s on not_found", async () => {
    game.endGameMatch.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/matches/m1/end", { method: "POST", body: {} }, deps())).status).toBe(404);

    game.endGameMatch.mockResolvedValueOnce({ ok: true, match: { id: "m1", status: "ended" } });
    const ok = await request("/games/matches/m1/end", { method: "POST", body: { result: { winner: "u1" } } }, deps());
    expect(ok.status).toBe(200);
    expect(game.endGameMatch).toHaveBeenCalledWith(expect.anything(), auth, "m1", { winner: "u1" });
  });
});

describe("fluxy game routes — npcs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /games/npcs lists NPCs", async () => {
    npcs.listGameNpcs.mockResolvedValueOnce([{ id: "npc_1", name: "Merlin" }]);
    const res = await request("/games/npcs", {}, deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.npcs).toHaveLength(1);
  });

  it("PUT /games/npcs 400s without a name", async () => {
    npcs.upsertGameNpc.mockResolvedValueOnce({ ok: false, error: "name_required" });
    const res = await request("/games/npcs", { method: "PUT", body: {} }, deps());
    expect(res.status).toBe(400);
  });

  it("POST /games/npcs/:id/interact maps 429 / 404 / 400", async () => {
    npcs.interactGameNpc.mockResolvedValueOnce({ ok: false, error: "rate_limit_exceeded", retryAfterSeconds: 30 });
    const limited = await request("/games/npcs/npc_1/interact", { method: "POST", body: { message: "hi" } }, deps());
    expect(limited.status).toBe(429);
    expect((await limited.json()).retryAfterSeconds).toBe(30);

    npcs.interactGameNpc.mockResolvedValueOnce({ ok: false, error: "npc_not_found" });
    expect((await request("/games/npcs/npc_x/interact", { method: "POST", body: { message: "hi" } }, deps())).status).toBe(404);

    npcs.interactGameNpc.mockResolvedValueOnce({ ok: false, error: "message_required" });
    expect((await request("/games/npcs/npc_1/interact", { method: "POST", body: {} }, deps())).status).toBe(400);

    npcs.interactGameNpc.mockResolvedValueOnce({ ok: true, reply: "Hello again!" });
    const ok = await request("/games/npcs/npc_1/interact", { method: "POST", body: { message: "hi", playerId: "u1" } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).reply).toBe("Hello again!");
    expect(npcs.interactGameNpc).toHaveBeenCalledWith(expect.anything(), auth, "npc_1", { message: "hi", playerId: "u1" });
  });
});

describe("fluxy game routes — checkpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /games/checkpoints defaults playerId to the caller", async () => {
    checkpoints.listGameCheckpoints.mockResolvedValueOnce({ ok: true, checkpoints: [] });
    const res = await request("/games/checkpoints", {}, deps());
    expect(res.status).toBe(200);
    expect(checkpoints.listGameCheckpoints).toHaveBeenCalledWith(expect.anything(), auth, "u1");
  });

  it("GET /games/checkpoints?crdt=1&roomId= merges the room snapshot", async () => {
    checkpoints.listGameCheckpointsMerged.mockResolvedValueOnce({ ok: true, checkpoints: [{ checkpointKey: "k" }] });
    const res = await request("/games/checkpoints?crdt=1&roomId=room_1&playerId=p9", {}, deps());
    expect(res.status).toBe(200);
    expect(checkpoints.listGameCheckpointsMerged).toHaveBeenCalledWith(expect.anything(), auth, "p9", "room_1");
    expect(checkpoints.listGameCheckpoints).not.toHaveBeenCalled();
  });

  it("GET /games/checkpoints/crdt-snapshot maps 400 / 502 / 500 / 200", async () => {
    const missing = await request("/games/checkpoints/crdt-snapshot", {}, deps());
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("roomId_required");

    crdt.fetchGameCheckpointCrdtSnapshot.mockResolvedValueOnce(null);
    expect((await request("/games/checkpoints/crdt-snapshot?roomId=room_1", {}, deps())).status).toBe(502);

    crdt.fetchGameCheckpointCrdtSnapshot.mockRejectedValueOnce(new Error("DO down"));
    expect((await request("/games/checkpoints/crdt-snapshot?roomId=room_1", {}, deps())).status).toBe(500);

    crdt.fetchGameCheckpointCrdtSnapshot.mockResolvedValueOnce({ roomId: "room_1", update: "AA==", checkpointCount: 2 });
    const ok = await request("/games/checkpoints/crdt-snapshot?roomId=room_1", {}, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).checkpointCount).toBe(2);
    expect(crdt.fetchGameCheckpointCrdtSnapshot).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      userId: "u1",
    });
  });

  it("PUT /games/checkpoints maps conflict → 409, error → 400", async () => {
    checkpoints.upsertGameCheckpoint.mockResolvedValueOnce({
      ok: false,
      conflict: true,
      checkpoint: { version: 2 },
    });
    const conflict = await request("/games/checkpoints", { method: "PUT", body: { checkpointKey: "k" } }, deps());
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).conflict).toBe(true);

    checkpoints.upsertGameCheckpoint.mockResolvedValueOnce({ ok: false, error: "invalid_state" });
    expect((await request("/games/checkpoints", { method: "PUT", body: {} }, deps())).status).toBe(400);

    checkpoints.upsertGameCheckpoint.mockResolvedValueOnce({ ok: true, checkpoint: { version: 3 } });
    const ok = await request("/games/checkpoints", { method: "PUT", body: { checkpointKey: "k" } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).checkpoint.version).toBe(3);
  });

  it("GET /games/checkpoints/:id maps not ok → 400, ok → 200", async () => {
    checkpoints.getGameCheckpoint.mockResolvedValueOnce({ ok: false, error: "checkpoint_required" });
    expect((await request("/games/checkpoints/k1", {}, deps())).status).toBe(400);

    checkpoints.getGameCheckpoint.mockResolvedValueOnce({ ok: true, checkpoint: { checkpointKey: "k1", version: 1 } });
    const ok = await request("/games/checkpoints/k1?playerId=p9", {}, deps());
    expect(ok.status).toBe(200);
    expect(checkpoints.getGameCheckpoint).toHaveBeenCalledWith(expect.anything(), auth, "k1", "p9");
  });

  it("DELETE /games/checkpoints/:id maps not ok → 400, ok → 200", async () => {
    checkpoints.deleteGameCheckpoint.mockResolvedValueOnce({ ok: false, error: "checkpoint_required" });
    expect((await request("/games/checkpoints/k1", { method: "DELETE" }, deps())).status).toBe(400);

    checkpoints.deleteGameCheckpoint.mockResolvedValueOnce({ ok: true, deleted: true });
    const ok = await request("/games/checkpoints/k1", { method: "DELETE" }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).deleted).toBe(true);
  });

  it("POST /games/checkpoints/:id/federate maps args and statuses", async () => {
    checkpoints.federateGameCheckpoint.mockResolvedValueOnce({ ok: false, error: "checkpoint_not_found" });
    expect((await request("/games/checkpoints/k1/federate", { method: "POST", body: { sourceRoomId: "a", targetRoomId: "b" } }, deps())).status).toBe(404);

    checkpoints.federateGameCheckpoint.mockResolvedValueOnce({ ok: false, error: "checkpoint_source_target_required" });
    expect((await request("/games/checkpoints/k1/federate", { method: "POST", body: {} }, deps())).status).toBe(400);

    checkpoints.federateGameCheckpoint.mockResolvedValueOnce({ ok: true, federated: true });
    const ok = await request("/games/checkpoints/k1/federate", { method: "POST", body: { roomId: "a", targetRoomId: "b", playerId: "u1" } }, deps());
    expect(ok.status).toBe(200);
    expect(checkpoints.federateGameCheckpoint).toHaveBeenCalledWith(expect.anything(), auth, {
      checkpointKey: "k1",
      playerId: "u1",
      sourceRoomId: "a",
      targetRoomId: "b",
    });
  });
});

describe("fluxy game routes — quests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /games/quests passes filters", async () => {
    quests.listGameQuests.mockResolvedValueOnce({ ok: true, quests: [] });
    const res = await request("/games/quests?status=pending&limit=10", {}, deps());
    expect(res.status).toBe(200);
    expect(quests.listGameQuests).toHaveBeenCalledWith(expect.anything(), auth, { status: "pending", limit: "10" });
  });

  it("POST /games/quests 400s without a title", async () => {
    quests.createGameQuest.mockResolvedValueOnce({ ok: false, error: "title_required" });
    const res = await request("/games/quests", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("title_required");
  });

  it("POST /games/quests/:id/moderate maps decision and not_found", async () => {
    quests.moderateGameQuest.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/quests/q1/moderate", { method: "POST", body: { decision: "approve" } }, deps())).status).toBe(404);

    quests.moderateGameQuest.mockResolvedValueOnce({ ok: true, quest: { id: "q1" } });
    const ok = await request("/games/quests/q1/moderate", { method: "POST", body: { decision: "reject" } }, deps());
    expect(ok.status).toBe(200);
    expect(quests.moderateGameQuest).toHaveBeenCalledWith(expect.anything(), auth, "q1", "reject");
  });

  it("POST /games/quests/:id/progress 404s when the quest is not available", async () => {
    quests.updateGameQuestProgress.mockResolvedValueOnce({ ok: false, error: "quest_not_available" });
    const res = await request("/games/quests/q1/progress", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(404);

    quests.updateGameQuestProgress.mockResolvedValueOnce({ ok: true, questId: "q1", completed: true });
    const ok = await request("/games/quests/q1/progress", { method: "POST", body: { completed: true } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).completed).toBe(true);
  });
});

describe("fluxy game routes — tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /games/tournaments passes the status filter", async () => {
    tournaments.listGameTournaments.mockResolvedValueOnce({ ok: true, tournaments: [] });
    const res = await request("/games/tournaments?status=active", {}, deps());
    expect(res.status).toBe(200);
    expect(tournaments.listGameTournaments).toHaveBeenCalledWith(expect.anything(), auth, { status: "active" });
  });

  it("POST /games/tournaments 400s without a name", async () => {
    tournaments.createGameTournament.mockResolvedValueOnce({ ok: false, error: "name_required" });
    expect((await request("/games/tournaments", { method: "POST", body: {} }, deps())).status).toBe(400);
  });

  it("GET /games/tournaments/:id 404s on not_found", async () => {
    tournaments.getGameTournament.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/tournaments/t1", {}, deps())).status).toBe(404);
  });

  it("POST /games/tournaments/:id/join defaults playerId to the caller", async () => {
    tournaments.registerTournamentPlayers.mockResolvedValueOnce({ ok: true, tournament: { id: "t1" } });
    const res = await request("/games/tournaments/t1/join", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(200);
    expect(tournaments.registerTournamentPlayers).toHaveBeenCalledWith(expect.anything(), auth, "t1", ["u1"]);

    tournaments.registerTournamentPlayers.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/games/tournaments/t1/join", { method: "POST", body: {} }, deps())).status).toBe(404);
  });

  it("POST /games/tournaments/:id/start maps errors to 400", async () => {
    tournaments.startGameTournament.mockResolvedValueOnce({ ok: false, error: "not_enough_players" });
    expect((await request("/games/tournaments/t1/start", { method: "POST", body: {} }, deps())).status).toBe(400);

    tournaments.startGameTournament.mockResolvedValueOnce({ ok: true, tournament: { id: "t1", status: "active" } });
    const ok = await request("/games/tournaments/t1/start", { method: "POST", body: { players: ["u1", "u2"] } }, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).tournament.status).toBe("active");
  });

  it("POST /games/tournaments/:id/matches/:matchId/report maps winner and 404", async () => {
    tournaments.reportTournamentMatch.mockResolvedValueOnce({ ok: false, error: "match_not_found" });
    expect((await request("/games/tournaments/t1/matches/mt1/report", { method: "POST", body: { winner: "u1" } }, deps())).status).toBe(404);

    tournaments.reportTournamentMatch.mockResolvedValueOnce({ ok: true, tournament: { id: "t1" } });
    const ok = await request("/games/tournaments/t1/matches/mt1/report", { method: "POST", body: { winner: "u2" } }, deps());
    expect(ok.status).toBe(200);
    expect(tournaments.reportTournamentMatch).toHaveBeenCalledWith(expect.anything(), auth, "t1", "mt1", "u2");
  });
});

describe("fluxy game routes — federation ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a valid federation secret", async () => {
    checkpoints.verifyFederationSecret.mockResolvedValueOnce(false);
    const res = await request("/games/federation/ingest", { method: "POST", body: {} }, deps());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("forbidden");
    expect(checkpoints.ingestFederatedCheckpoint).not.toHaveBeenCalled();
  });

  it("ingests a checkpoint with a valid secret and maps payload errors to 400", async () => {
    checkpoints.verifyFederationSecret.mockResolvedValueOnce(true);
    checkpoints.ingestFederatedCheckpoint.mockResolvedValueOnce({ ok: false, error: "federation_payload_required" });
    const bad = await request(
      "/games/federation/ingest",
      { method: "POST", body: {}, headers: { "X-Fluxy-Federation-Secret": "s3cret" } },
      deps(),
    );
    expect(bad.status).toBe(400);
    expect(checkpoints.verifyFederationSecret).toHaveBeenCalledWith(
      expect.objectContaining({ DB: null }),
      "s3cret",
    );

    checkpoints.verifyFederationSecret.mockResolvedValueOnce(true);
    checkpoints.ingestFederatedCheckpoint.mockResolvedValueOnce({ ok: true, checkpoint: { checkpointKey: "k1" } });
    const ok = await request(
      "/games/federation/ingest",
      { method: "POST", body: { checkpointKey: "k1" }, headers: { "X-Fluxy-Federation-Secret": "s3cret" } },
      deps(),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).checkpoint.checkpointKey).toBe("k1");
  });
});
