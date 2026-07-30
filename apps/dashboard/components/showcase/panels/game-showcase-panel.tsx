"use client";

import React from "react";
import { Gamepad2, Loader2, Swords } from "lucide-react";
import { createWorkerFluxyGameClient } from "@fluxy-chat/sdk";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

export function GameShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string>("Ready to matchmake");
  const [matchId, setMatchId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const [wsLive, setWsLive] = React.useState(false);

  React.useEffect(() => {
    const conn = client.connectRoom(roomId);
    conn.connect();
    const off = conn.onServerEvent((ev) => {
      setWsLive(true);
      if (ev.name === "game.match_started") {
        setMatchId(String(ev.data.matchId ?? ""));
        setStatus("Match live (WS)");
      }
      if (ev.name === "game.tick") {
        const nextTick = Number(ev.data.tick);
        if (Number.isFinite(nextTick)) setTick(nextTick);
      }
    });
    return () => {
      off();
      conn.close();
    };
  }, [client, roomId]);

  async function runMatchmake() {
    setBusy(true);
    setStatus("Finding lobby…");
    try {
      const game = createWorkerFluxyGameClient(client);
      const player = await game.upsertPlayer({
        playerId: client.userId,
        username: `Player-${client.userId.slice(-4)}`,
      });
      const lobby = await game.matchmake({
        roomId,
        playerId: player.id,
        gameMode: "demo-duel",
        maxPlayers: 4,
      });
      setStatus(`Lobby ${lobby.lobbyId} · ${lobby.players.length} player(s)`);
      const started = await game.startMatch(lobby.lobbyId);
      setMatchId(started.matchId);
      const input = await game.submitInput(started.matchId, { action: "move", x: 1, y: 0 });
      setTick(input.tick);
      setStatus(wsLive ? `Match live · tick ${input.tick} (WS)` : `Match live · tick ${input.tick}`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Simulated match · ${error.message.split(":")[0]}`
          : "Simulated arena — enable /games on Worker for live state",
      );
      setMatchId("demo-match");
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          <Gamepad2 className="size-5" aria-hidden />
        </span>
        <div>
          <h4 className="font-semibold text-foreground">FluxyGame arena</h4>
          <p className="text-xs text-muted-foreground">
            Edge matchmaking + ticks · room {roomId}
            {wsLive ? " · WS live" : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex-1 rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm">
        <p className="text-muted-foreground">Status</p>
        <p className="mt-1 font-medium text-foreground">{status}</p>
        {matchId ? (
          <p className="mt-3 text-xs text-muted-foreground">
            matchId: {matchId}
            {tick ? ` · tick ${tick}` : null}
          </p>
        ) : null}
      </div>

      <Button type="button" className="mt-4" onClick={() => void runMatchmake()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Swords className="mr-2 size-4" aria-hidden />}
        {busy ? "Matchmaking…" : "Quick matchmake"}
      </Button>
    </div>
  );
}
