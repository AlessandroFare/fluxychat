import type { FluxyChatClient } from "./index";
import type { GameEvent, InputCommand, MatchResult, Player } from "./fluxy-game";

export interface WorkerFluxyGameClient {
  upsertPlayer(input: Partial<Player> & { playerId?: string; cloudSave?: Record<string, unknown> }): Promise<Player>;
  matchmake(input: { playerId?: string; gameMode?: string; maxPlayers?: number; roomId?: string; skillRating?: number }): Promise<{ lobbyId: string; players: string[] }>;
  startMatch(lobbyId: string): Promise<{ matchId: string }>;
  getMatch(matchId: string): Promise<{ status: string; state: Record<string, unknown> }>;
  submitInput(matchId: string, input: InputCommand | Record<string, unknown>): Promise<{ tick: number; events: GameEvent[] }>;
  endMatch(matchId: string, result?: MatchResult): Promise<void>;
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
  };
}
