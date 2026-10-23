import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createWorkerFluxyGameClient } from "./worker-fluxy-game-client";

const baseUrl = "http://127.0.0.1:8787";

function client() {
  return createWorkerFluxyGameClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function callMethod(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return (mock.mock.calls[i]?.[1] as RequestInit).method;
}

function callBody(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return JSON.parse(String((mock.mock.calls[i]?.[1] as RequestInit).body));
}

describe("createWorkerFluxyGameClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("upserts a player and matchmakes", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, player: { id: "p1", username: "Alice" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, lobby: { id: "lobby_1", players: ["p1"] } }));
    const game = client();

    const player = await game.upsertPlayer({ playerId: "p1", username: "Alice", skillRating: 1200 });
    const lobby = await game.matchmake({ playerId: "p1", gameMode: "deathmatch" });

    expect(player.id).toBe("p1");
    expect(lobby).toEqual({ lobbyId: "lobby_1", players: ["p1"] });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/games/players");
    expect(callMethod(fetchMock, 0)).toBe("PUT");
    expect(callBody(fetchMock, 0).skillRating).toBe(1200);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/games/lobbies/matchmake");
  });

  it("lists lobbies with filters and joins/leaves a lobby", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, lobbies: [{ id: "lobby_1", gameMode: "deathmatch", state: "waiting", players: ["p1"] }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, lobby: { id: "lobby_1", players: ["p1", "p2"], state: "waiting" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, lobby: { id: "lobby_1", players: ["p1"], state: "waiting" } }));
    const game = client();

    const rows = await game.listLobbies({ gameMode: "deathmatch", state: "waiting" });
    const joined = await game.joinLobby("lobby_1", "p2");
    const left = await game.leaveLobby("lobby_1", "p2");

    expect(rows[0]?.id).toBe("lobby_1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("gameMode=deathmatch");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("state=waiting");
    expect(joined).toEqual({ lobbyId: "lobby_1", players: ["p1", "p2"], state: "waiting" });
    expect(left.players).toEqual(["p1"]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/games/lobbies/lobby_1/join");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/games/lobbies/lobby_1/leave");
  });

  it("runs the match lifecycle: start, input, get, list, end", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, match: { id: "m1" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, match: { state: { tick: 3, events: [] } } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, match: { status: "playing", state: { tick: 3 } } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, matches: [{ id: "m1", status: "playing", size: 2 }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const game = client();

    const { matchId } = await game.startMatch("lobby_1");
    const input = await game.submitInput(matchId, { playerId: "p1", sequence: 1, actions: [{ type: "move", payload: { dx: 1, dy: 0 } }] });
    const match = await game.getMatch(matchId);
    const list = await game.listMatches({ status: "playing" });
    await game.endMatch(matchId, { matchId, winner: "p1", duration: 30, scores: {}, mvp: "p1", events: [] });

    expect(matchId).toBe("m1");
    expect(input.tick).toBe(3);
    expect(match.status).toBe("playing");
    expect(list).toHaveLength(1);
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("status=playing");
    expect(callBody(fetchMock, 4).result.winner).toBe("p1");
  });

  it("runs the party flow", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, parties: [{ id: "party_1", members: ["p1"], leaderId: "p1" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, party: { id: "party_1", members: ["p1"], leaderId: "p1" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, party: { id: "party_1", members: ["p1"], leaderId: "p1" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, party: { id: "party_1", members: ["p1", "p2"] } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, party: { id: "party_1", members: ["p1"] } }));
    const game = client();

    expect((await game.listParties())[0]?.id).toBe("party_1");
    expect((await game.createParty({ roomId: "room_1" })).id).toBe("party_1");
    expect((await game.getParty("party_1")).leaderId).toBe("p1");
    expect((await game.joinParty("party_1", "p2")).members).toEqual(["p1", "p2"]);
    expect((await game.leaveParty("party_1", "p2")).members).toEqual(["p1"]);
  });

  it("queries the leaderboard with limit and around", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, leaderboard: [{ rank: 1, playerId: "p1", username: "Alice", skillRating: 1200, region: "eu", stats: {}, updatedAt: "t" }] }));
    const rows = await client().listLeaderboard(10, "p1");
    expect(rows[0]?.rank).toBe(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/games/leaderboard");
    expect(url).toContain("limit=10");
    expect(url).toContain("around=p1");
  });

  it("handles NPCs including the 429 rate limit", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, npcs: [{ id: "npc_1", name: "Merlin", personality: "friendly", difficulty: 0.6 }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, npc: { id: "npc_1", name: "Merlin" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, reply: "Hello again!" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "rate_limit_exceeded", retryAfterSeconds: 30 }, 429));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "npc_not_found" }, 404));
    const game = client();

    expect((await game.listNpcs())[0]?.name).toBe("Merlin");
    expect((await game.upsertNpc({ name: "Merlin", personality: "friendly" })).id).toBe("npc_1");
    expect((await game.interactNpc("npc_1", { message: "hi" })).reply).toBe("Hello again!");
    const limited = await game.interactNpc("npc_1", { message: "hi" });
    expect(limited).toEqual({ reply: "", retryAfterSeconds: 30 });
    await expect(game.interactNpc("npc_x", { message: "hi" })).rejects.toThrow("npc_not_found");
  });

  it("handles checkpoints: list, crdt, get null, delete, 409 conflict, federate", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, checkpoints: [{ checkpointKey: "k1", state: {}, version: 1, updatedAt: "t" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, checkpoint: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, deleted: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, conflict: true, checkpoint: { checkpointKey: "k1", state: { hp: 50 }, version: 4 } }, 409));
    fetchMock.mockResolvedValueOnce(jsonResponse({ roomId: "room_1", update: "AA==", checkpointCount: 2 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, federated: true, checkpoint: { checkpointKey: "k1", state: {}, version: 1 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "checkpoint_not_found" }, 404));
    const game = client();

    expect((await game.listCheckpoints("p1", { roomId: "room_1", crdt: true }))[0]?.checkpointKey).toBe("k1");
    const listUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(listUrl).toContain("playerId=p1");
    expect(listUrl).toContain("roomId=room_1");
    expect(listUrl).toContain("crdt=1");

    expect(await game.getCheckpoint("k1")).toBeNull();
    expect(await game.deleteCheckpoint("k1")).toEqual({ deleted: true });
    expect(callMethod(fetchMock, 2)).toBe("DELETE");

    const conflict = await game.upsertCheckpoint({ checkpointKey: "k1", state: {}, expectedVersion: 3 });
    expect(conflict.conflict).toBe(true);
    expect(conflict.checkpoint.version).toBe(4);

    expect((await game.fetchCheckpointCrdtSnapshot("room_1")).checkpointCount).toBe(2);

    const federated = await game.federateCheckpoint("k1", { sourceRoomId: "room_a", targetRoomId: "room_b" });
    expect(federated.federated).toBe(true);
    expect(callBody(fetchMock, 5).targetRoomId).toBe("room_b");

    await expect(game.federateCheckpoint("k_x", { sourceRoomId: "a", targetRoomId: "b" })).rejects.toThrow("checkpoint_not_found");
  });

  it("runs quests and tournaments", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, quests: [{ id: "q1", title: "Key", moderationStatus: "approved", objectives: [] }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, quest: { id: "q2", title: "Flag", moderationStatus: "pending" }, pendingModeration: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, quest: { id: "q2" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tournaments: [{ id: "t1", name: "Cup", status: "registration", prize: "$", rounds: [], currentPlayers: 0, maxPlayers: 8 }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tournament: { id: "t1", name: "Cup", status: "registration" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tournament: { id: "t1", name: "Cup", status: "registration" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tournament: { id: "t1", name: "Cup", status: "active", rounds: [{ round: 1, matches: [] }] } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tournament: { id: "t1", status: "active", rounds: [] } }));
    const game = client();

    expect((await game.listQuests({ status: "pending" }))[0]?.id).toBe("q1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("status=pending");
    const created = await game.createQuest({ title: "Flag", roomId: "room_1" });
    expect(created.pendingModeration).toBe(true);
    await game.moderateQuest("q2", "approve");
    expect(callBody(fetchMock, 2).decision).toBe("approve");
    await game.updateQuestProgress("q2", { progress: { keys: 1 }, completed: true });

    expect((await game.listTournaments({ status: "registration" }))[0]?.id).toBe("t1");
    expect((await game.createTournament({ name: "Cup", maxPlayers: 8 })).id).toBe("t1");
    expect((await game.joinTournament("t1", "p9")).id).toBe("t1");
    expect((await game.startTournament("t1", { players: ["p1", "p2"] })).status).toBe("active");
    expect((await game.reportTournamentMatch("t1", "mt1", "p1")).id).toBe("t1");
    const reportUrl = String(fetchMock.mock.calls[8]?.[0]);
    expect(reportUrl).toContain("/games/tournaments/t1/matches/mt1/report");
  });

  it("throws operation-named errors on unexpected statuses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "version_conflict" }, 400));
    const game = client();

    await expect(game.listLobbies()).rejects.toThrow("listLobbies failed: 500");
    await expect(game.upsertCheckpoint({ checkpointKey: "k1", state: {} })).rejects.toThrow("version_conflict");
  });
});
