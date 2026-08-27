import type { FluxyChatClient } from "./index";
import type { GameEvent, InputCommand, MatchResult, Player } from "./fluxy-game";

export interface WorkerFluxyGameClient {
  upsertPlayer(input: Partial<Player> & { playerId?: string; cloudSave?: Record<string, unknown> }): Promise<Player>;
  matchmake(input: { playerId?: string; gameMode?: string; maxPlayers?: number; roomId?: string; skillRating?: number }): Promise<{ lobbyId: string; players: string[] }>;
  startMatch(lobbyId: string): Promise<{ matchId: string }>;
  getMatch(matchId: string): Promise<{ status: string; state: Record<string, unknown> }>;
  submitInput(matchId: string, input: InputCommand | Record<string, unknown>): Promise<{ tick: number; events: GameEvent[] }>;
  endMatch(matchId: string, result?: MatchResult): Promise<void>;
  listLeaderboard(limit?: number): Promise<
    Array<{
      rank: number;
      playerId: string;
      username: string;
      skillRating: number;
      region: string;
      stats: Record<string, unknown>;
      updatedAt: string;
    }>
  >;
  listNpcs(): Promise<Array<{ id: string; name: string; personality: string; difficulty: number }>>;
  upsertNpc(input: { id?: string; name: string; personality?: string; difficulty?: number }): Promise<{ id: string; name: string }>;
  interactNpc(npcId: string, input: { message: string; playerId?: string }): Promise<{ reply: string; retryAfterSeconds?: number }>;
  listCheckpoints(playerId?: string, options?: { roomId?: string; crdt?: boolean }): Promise<Array<{ checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string }>>;
  getCheckpoint(checkpointKey: string, playerId?: string, options?: { roomId?: string; crdt?: boolean }): Promise<{ checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string } | null>;
  upsertCheckpoint(input: { checkpointKey: string; state: Record<string, unknown>; expectedVersion?: number; playerId?: string; roomId?: string }): Promise<{ checkpoint: { checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string }; conflict?: boolean }>;
  fetchCheckpointCrdtSnapshot(roomId: string): Promise<{ update: string; checkpointCount: number; roomId: string }>;
  federateCheckpoint(
    checkpointKey: string,
    input: { sourceRoomId: string; targetRoomId: string; playerId?: string; roomId?: string },
  ): Promise<{
    ok?: boolean;
    checkpoint?: { checkpointKey: string; state: Record<string, unknown>; version: number };
    federated?: boolean;
    error?: string;
  }>;
  listQuests(filter?: { status?: string }): Promise<Array<{ id: string; title: string; moderationStatus: string; objectives: unknown[] }>>;
  createQuest(input: { title: string; description?: string; roomId?: string; objectives?: unknown[] }): Promise<{ quest: { id: string; title: string; moderationStatus: string }; pendingModeration?: boolean }>;
  moderateQuest(questId: string, decision: "approve" | "reject"): Promise<void>;
  updateQuestProgress(questId: string, input: { progress?: Record<string, unknown>; completed?: boolean; playerId?: string }): Promise<void>;
  listTournaments(filter?: { status?: string }): Promise<Array<{ id: string; name: string; status: string; prize: string; rounds: unknown[]; currentPlayers: number; maxPlayers: number }>>;
  createTournament(input: { name: string; maxPlayers?: number; prize?: string; roomId?: string; players?: string[] }): Promise<{ id: string; name: string; status: string }>;
  startTournament(tournamentId: string, input?: { players?: string[] }): Promise<{ id: string; name: string; status: string; rounds: unknown[] }>;
  reportTournamentMatch(tournamentId: string, matchId: string, winner: string): Promise<{ id: string; status: string; rounds: unknown[] }>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

export function createWorkerFluxyGameClient(client: FluxyChatClient): WorkerFluxyGameClient {
  return {
    async upsertPlayer(input) {
      const res = await fetch(`${base(client)}/games/players`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`upsertPlayer failed: ${res.status}`);
      const body = (await res.json()) as { player: Player };
      return body.player;
    },
    async matchmake(input) {
      const res = await fetch(`${base(client)}/games/lobbies/matchmake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`matchmake failed: ${res.status}`);
      const body = (await res.json()) as { lobby: { id: string; players: string[] } };
      return { lobbyId: body.lobby.id, players: body.lobby.players };
    },
    async startMatch(lobbyId) {
      const res = await fetch(`${base(client)}/games/lobbies/${encodeURIComponent(lobbyId)}/start`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`startMatch failed: ${res.status}`);
      const body = (await res.json()) as { match: { id: string } };
      return { matchId: body.match.id };
    },
    async getMatch(matchId) {
      const res = await fetch(`${base(client)}/games/matches/${encodeURIComponent(matchId)}`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getMatch failed: ${res.status}`);
      const body = (await res.json()) as { match: { status: string; state: Record<string, unknown> } };
      return body.match;
    },
    async submitInput(matchId, input) {
      const res = await fetch(`${base(client)}/games/matches/${encodeURIComponent(matchId)}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`submitInput failed: ${res.status}`);
      const body = (await res.json()) as { match: { state: { tick: number; events: GameEvent[] } } };
      return { tick: body.match.state.tick, events: body.match.state.events };
    },
    async endMatch(matchId, result) {
      const res = await fetch(`${base(client)}/games/matches/${encodeURIComponent(matchId)}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error(`endMatch failed: ${res.status}`);
    },
    async listLeaderboard(limit) {
      const url = new URL(`${base(client)}/games/leaderboard`);
      if (limit) url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listLeaderboard failed: ${res.status}`);
      const body = (await res.json()) as {
        leaderboard?: Array<{
          rank: number;
          playerId: string;
          username: string;
          skillRating: number;
          region: string;
          stats: Record<string, unknown>;
          updatedAt: string;
        }>;
      };
      return body.leaderboard ?? [];
    },
    async listNpcs() {
      const res = await fetch(`${base(client)}/games/npcs`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`listNpcs failed: ${res.status}`);
      const body = (await res.json()) as { npcs?: Array<{ id: string; name: string; personality: string; difficulty: number }> };
      return body.npcs ?? [];
    },
    async upsertNpc(input) {
      const res = await fetch(`${base(client)}/games/npcs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`upsertNpc failed: ${res.status}`);
      const body = (await res.json()) as { npc: { id: string; name: string } };
      return body.npc;
    },
    async interactNpc(npcId, input) {
      const res = await fetch(`${base(client)}/games/npcs/${encodeURIComponent(npcId)}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as { ok?: boolean; reply?: string; error?: string; retryAfterSeconds?: number };
      if (res.status === 429) {
        return { reply: "", retryAfterSeconds: body.retryAfterSeconds ?? 60 };
      }
      if (!res.ok || !body.ok) throw new Error(body.error || `interactNpc failed: ${res.status}`);
      return { reply: body.reply ?? "" };
    },
    async listCheckpoints(playerId, options) {
      const url = new URL(`${base(client)}/games/checkpoints`);
      if (playerId) url.searchParams.set("playerId", playerId);
      if (options?.roomId) url.searchParams.set("roomId", options.roomId);
      if (options?.crdt) url.searchParams.set("crdt", "1");
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listCheckpoints failed: ${res.status}`);
      const body = (await res.json()) as { checkpoints?: Array<{ checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string }> };
      return body.checkpoints ?? [];
    },
    async getCheckpoint(checkpointKey, playerId, options) {
      const url = new URL(`${base(client)}/games/checkpoints/${encodeURIComponent(checkpointKey)}`);
      if (playerId) url.searchParams.set("playerId", playerId);
      if (options?.roomId) url.searchParams.set("roomId", options.roomId);
      if (options?.crdt) url.searchParams.set("crdt", "1");
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`getCheckpoint failed: ${res.status}`);
      const body = (await res.json()) as { checkpoint?: { checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string } | null };
      return body.checkpoint ?? null;
    },
    async upsertCheckpoint(input) {
      const res = await fetch(`${base(client)}/games/checkpoints`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as { ok?: boolean; checkpoint?: { checkpointKey: string; state: Record<string, unknown>; version: number; updatedAt: string }; conflict?: boolean; error?: string };
      if (res.status === 409) {
        return { checkpoint: body.checkpoint!, conflict: true };
      }
      if (!res.ok || !body.checkpoint) throw new Error(body.error || `upsertCheckpoint failed: ${res.status}`);
      return { checkpoint: body.checkpoint };
    },
    async fetchCheckpointCrdtSnapshot(roomId) {
      const url = new URL(`${base(client)}/games/checkpoints/crdt-snapshot`);
      url.searchParams.set("roomId", roomId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`fetchCheckpointCrdtSnapshot failed: ${res.status}`);
      return (await res.json()) as { update: string; checkpointCount: number; roomId: string };
    },
    async federateCheckpoint(
      checkpointKey: string,
      input: { sourceRoomId: string; targetRoomId: string; playerId?: string; roomId?: string },
    ) {
      const res = await fetch(`${base(client)}/games/checkpoints/${encodeURIComponent(checkpointKey)}/federate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        checkpoint?: { checkpointKey: string; state: Record<string, unknown>; version: number };
        federated?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error || `federateCheckpoint failed: ${res.status}`);
      return body;
    },
    async listQuests(filter) {
      const url = new URL(`${base(client)}/games/quests`);
      if (filter?.status) url.searchParams.set("status", filter.status);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listQuests failed: ${res.status}`);
      const body = (await res.json()) as { quests?: Array<{ id: string; title: string; moderationStatus: string; objectives: unknown[] }> };
      return body.quests ?? [];
    },
    async createQuest(input) {
      const res = await fetch(`${base(client)}/games/quests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createQuest failed: ${res.status}`);
      return (await res.json()) as { quest: { id: string; title: string; moderationStatus: string }; pendingModeration?: boolean };
    },
    async moderateQuest(questId, decision) {
      const res = await fetch(`${base(client)}/games/quests/${encodeURIComponent(questId)}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`moderateQuest failed: ${res.status}`);
    },
    async updateQuestProgress(questId, input) {
      const res = await fetch(`${base(client)}/games/quests/${encodeURIComponent(questId)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`updateQuestProgress failed: ${res.status}`);
    },
    async listTournaments(filter) {
      const url = new URL(`${base(client)}/games/tournaments`);
      if (filter?.status) url.searchParams.set("status", filter.status);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listTournaments failed: ${res.status}`);
      const body = (await res.json()) as { tournaments?: Array<{ id: string; name: string; status: string; prize: string; rounds: unknown[]; currentPlayers: number; maxPlayers: number }> };
      return body.tournaments ?? [];
    },
    async createTournament(input) {
      const res = await fetch(`${base(client)}/games/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createTournament failed: ${res.status}`);
      const body = (await res.json()) as { tournament: { id: string; name: string; status: string } };
      return body.tournament;
    },
    async startTournament(tournamentId, input) {
      const res = await fetch(`${base(client)}/games/tournaments/${encodeURIComponent(tournamentId)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input ?? {}),
      });
      if (!res.ok) throw new Error(`startTournament failed: ${res.status}`);
      const body = (await res.json()) as { tournament: { id: string; name: string; status: string; rounds: unknown[] } };
      return body.tournament;
    },
    async reportTournamentMatch(tournamentId, matchId, winner) {
      const res = await fetch(`${base(client)}/games/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ winner }),
      });
      if (!res.ok) throw new Error(`reportTournamentMatch failed: ${res.status}`);
      const body = (await res.json()) as { tournament: { id: string; status: string; rounds: unknown[] } };
      return body.tournament;
    },
  };
}
