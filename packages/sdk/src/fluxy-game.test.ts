import { describe, expect, it } from "vitest";
import { createFluxyGame } from "./fluxy-game";

function startedMatch() {
  const game = createFluxyGame();
  game.registerPlayer("alice", "Alice");
  game.registerPlayer("bob", "Bob");
  const lobbyId = game.findMatch("alice")!;
  game.findMatch("bob", "deathmatch", 4);
  const matchId = game.startMatch(lobbyId)!;
  return { game, lobbyId, matchId };
}

describe("createFluxyGame matchmaking", () => {
  it("reuses a waiting lobby and rejects unregistered players", () => {
    const game = createFluxyGame();
    game.registerPlayer("alice", "Alice");
    game.registerPlayer("bob", "Bob");
    expect(game.findMatch("ghost")).toBeNull();

    const lobbyId = game.findMatch("alice");
    expect(game.findMatch("bob", "deathmatch", 4)).toBe(lobbyId);

    // Different mode opens a new lobby
    expect(game.findMatch("bob", "ctf", 4)).not.toBe(lobbyId);
  });

  it("only starts with two players and spawns owned entities", () => {
    const game = createFluxyGame();
    game.registerPlayer("alice", "Alice");
    const solo = game.findMatch("alice")!;
    expect(game.startMatch(solo)).toBeNull();

    const { game: duo, matchId } = startedMatch();
    const state = duo.spectate(matchId)!;
    expect(state.tick).toBe(0);
    expect(state.entities.get("ent_alice")?.ownerId).toBe("alice");
    expect(state.entities.get("ent_bob")?.health).toBe(100);
  });
});

describe("createFluxyGame authoritative input", () => {
  it("ignores stale sequences, foreign entities and non-finite moves", () => {
    const { game, matchId } = startedMatch();
    const spawnX = game.spectate(matchId)!.entities.get("ent_alice")!.x;

    game.processInput(matchId, { playerId: "alice", sequence: -1, actions: [{ type: "move", payload: { dx: 1, dy: 0 } }] });
    game.processInput(matchId, { playerId: "alice", sequence: 0, actions: [{ type: "move", payload: { dx: Number.NaN, dy: 0 } }] });
    // Bob cannot move Alice's entity by claiming her playerId? Alice owns ent_alice only when playerId matches.
    game.processInput(matchId, { playerId: "alice", sequence: 0, actions: [{ type: "move", payload: { dx: 1, dy: 0 } }] });
    expect(game.spectate(matchId)!.entities.get("ent_alice")!.x).toBe(spawnX);

    // Valid sequence moves, clamped to ±1 step of 5
    game.processInput(matchId, { playerId: "alice", sequence: 1, actions: [{ type: "move", payload: { dx: 5, dy: -5 } }] });
    const after = game.spectate(matchId)!.entities.get("ent_alice")!;
    expect(after.x).toBe(spawnX + 5);
    expect(after.velocity).toEqual({ x: 5, y: -5 });

    // Stale sequence is dropped
    game.processInput(matchId, { playerId: "alice", sequence: 1, actions: [{ type: "move", payload: { dx: -1, dy: 0 } }] });
    expect(game.spectate(matchId)!.entities.get("ent_alice")!.x).toBe(spawnX + 5);

    game.processInput("match_missing", { playerId: "alice", sequence: 1, actions: [] });
  });

  it("applies shoot damage, death events and kill/death stats", () => {
    const { game, matchId } = startedMatch();
    for (let i = 0; i < 4; i++) {
      game.processInput(matchId, {
        playerId: "alice",
        sequence: i,
        actions: [{ type: "shoot", payload: { targetId: "bob" } }],
      });
    }
    const state = game.spectate(matchId)!;
    expect(state.entities.get("ent_bob")!.health).toBe(0);
    expect(state.events.some((e) => e.type === "death")).toBe(true);
    expect((state.entities.get("ent_alice")!.metadata as Record<string, number>).kills).toBe(1);

    // A dead entity cannot shoot back
    game.processInput(matchId, { playerId: "bob", sequence: 0, actions: [{ type: "shoot", payload: { targetId: "alice" } }] });
    expect(game.spectate(matchId)!.entities.get("ent_alice")!.health).toBe(100);
  });

  it("advances ticks and records replays", () => {
    const { game, matchId } = startedMatch();
    game.processInput(matchId, { playerId: "alice", sequence: 0, actions: [{ type: "ability", payload: { name: "dash" } }] });
    expect(game.tickMatch(matchId)!.tick).toBe(1);
    expect(game.tickMatch("match_missing")).toBeNull();
    expect(game.getReplay(matchId)).toHaveLength(1);
    expect(game.getReplay(matchId)[0]?.inputs[0]?.playerId).toBe("alice");
  });
});

describe("createFluxyGame scoring", () => {
  it("ends a match with scores, winner/mvp and rating updates", () => {
    const { game, matchId } = startedMatch();
    for (let i = 0; i < 4; i++) {
      game.processInput(matchId, { playerId: "alice", sequence: i, actions: [{ type: "shoot", payload: { targetId: "bob" } }] });
    }
    const result = game.endMatch(matchId)!;
    expect(result.winner).toBe("alice");
    expect(result.mvp).toBe("alice");
    expect(result.scores).toEqual({ alice: 100, bob: -50 });
    expect(result.events.length).toBeGreaterThan(0);

    expect(game.spectate(matchId)).toBeNull();
    expect(game.endMatch(matchId)).toBeNull();

    const board = game.getLeaderboard();
    expect(board[0]?.playerId).toBe("alice");
    expect(board[0]?.score).toBe(1025);
    expect(board[1]?.score).toBe(985);
  });
});

describe("createFluxyGame social + saves", () => {
  it("runs the party invite flow", () => {
    const game = createFluxyGame();
    const partyId = game.createParty("alice");
    const invite = game.inviteToParty(partyId, "alice", "bob");
    expect(game.acceptPartyInvite(invite.id)).toBe(true);
    expect(game.getParty(partyId)?.members).toEqual(["alice", "bob"]);
    expect(game.acceptPartyInvite("inv_missing")).toBe(false);
    expect(game.getParty("party_missing")).toBeNull();
  });

  it("runs tournaments with placeholder brackets", () => {
    const game = createFluxyGame();
    const tournament = game.createTournament("Cup", 8, "$500");
    expect(tournament.status).toBe("registration");
    expect(game.startTournament(tournament.id)).toBe(false);

    tournament.currentPlayers = 4;
    expect(game.startTournament(tournament.id)).toBe(true);
    expect(tournament.rounds).toHaveLength(1);
    expect(tournament.rounds[0]?.matches).toHaveLength(2);

    const [first, second] = tournament.rounds[0]!.matches;
    expect(game.reportTournamentMatch(tournament.id, first!.id, first!.player1)).toBe(true);
    expect(tournament.status).toBe("active");
    expect(game.reportTournamentMatch(tournament.id, second!.id, second!.player2)).toBe(true);
    expect(tournament.rounds).toHaveLength(2);

    const final = tournament.rounds[1]!.matches[0]!;
    expect(game.reportTournamentMatch(tournament.id, final.id, final.player1)).toBe(true);
    expect(tournament.status).toBe("completed");

    expect(game.reportTournamentMatch("tourney_missing", final.id, "x")).toBe(false);
    expect(game.reportTournamentMatch(tournament.id, "tm_missing", "x")).toBe(false);
    expect(game.listTournaments()).toHaveLength(1);
  });

  it("merges cloud saves", () => {
    const game = createFluxyGame();
    expect(game.loadPlayerData("alice")).toBeNull();
    game.savePlayerData("alice", { level: 2 });
    game.savePlayerData("alice", { coins: 50 });
    expect(game.loadPlayerData("alice")).toEqual({ level: 2, coins: 50 });
  });

  it("keeps NPC memory and answers within the personality pool", () => {
    const game = createFluxyGame();
    const npc = game.spawnNPC("Merlin", "merchant", 0.6);
    const reply = game.npcInteract(npc.id, "alice", "do you sell keys?");
    expect(reply.length).toBeGreaterThan(0);
    expect(npc.memory.get("alice")).toBe("do you sell keys?");
    expect(game.npcInteract("npc_missing", "alice", "hi")).toBe("NPC not found");
  });

  it("adjusts difficulty and rating by performance band", () => {
    const game = createFluxyGame();
    game.registerPlayer("alice", "Alice");
    expect(game.adjustDifficulty("ghost", 0.9)).toBe(0.5);
    expect(game.adjustDifficulty("alice", 0.9)).toBeCloseTo(0.66);
    expect(game.adjustDifficulty("alice", 0.1)).toBeCloseTo(0.34);
    expect(game.adjustDifficulty("alice", 0.5)).toBe(0.5);
    expect(game.getLeaderboard()[0]?.playerId).toBe("alice");
  });
});
