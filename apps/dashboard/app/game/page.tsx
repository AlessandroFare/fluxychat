"use client";

import React, { useState } from "react";
import {
  Gamepad2, Users, Trophy, Play, Square, Eye, Bot,
  PartyPopper, Swords, Target, Skull, Heart, Zap, Loader2, Plus,
} from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { cn } from "@/lib/utils";
import { createFluxyGame, type FluxyGameApi, type MatchResult } from "@fluxy-chat/sdk";

interface GameLeaderboardEntry {
  playerId: string;
  username: string;
  score: number;
  rank: number;
  wins: number;
  losses: number;
  kdRatio: number;
}

function createSeededGame(): FluxyGameApi {
  const game = createFluxyGame();
  game.registerPlayer("p1", "Alice", "eu", 1200);
  game.registerPlayer("p2", "Bob", "eu", 1150);
  game.registerPlayer("p3", "Charlie", "eu", 1300);
  game.registerPlayer("p4", "Diana", "eu", 950);
  game.registerPlayer("p5", "Eve", "eu", 1400);
  game.registerPlayer("p6", "Frank", "eu", 1050);
  return game;
}

export default function FluxyGamePage() {
  const [game] = useState<FluxyGameApi | null>(createSeededGame());
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"match" | "leaderboard" | "npc" | "tournament" | "party">("match");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [spectating, setSpectating] = useState(false);

  if (!game) return null;

  const players = [
    game["registerPlayer" as never] as never,
  ];

  const handleQuickMatch = () => {
    const id1 = game.findMatch("p1", "deathmatch", 4);
    game.findMatch("p2", "deathmatch", 4);
    game.findMatch("p3", "deathmatch", 4);
    game.findMatch("p4", "deathmatch", 4);
    if (id1) {
      const mid = game.startMatch(id1);
      setMatchId(mid);
      setMatchResult(null);
    }
  };

  const handleSimulate = () => {
    if (!matchId) return;
    // Simulate some inputs
    for (let i = 0; i < 20; i++) {
      const playerId = ["p1", "p2", "p3", "p4"][i % 4];
      const targetId = ["p1", "p2", "p3", "p4"].filter((p) => p !== playerId)[i % 3];
      game.processInput(matchId, {
        tick: i, playerId, sequence: i,
        actions: i % 3 === 0
          ? [{ type: "shoot", payload: { targetId } }]
          : [{ type: "move", payload: { dx: Math.random() - 0.5, dy: Math.random() - 0.5 } }],
      });
      game.tickMatch(matchId);
    }
  };

  const handleEndMatch = () => {
    if (!matchId) return;
    const result = game.endMatch(matchId);
    setMatchResult(result);
    setMatchId(null);
    setSpectating(false);
  };

  const tabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: "match", label: "Match & Replay", icon: <Swords className="size-3.5" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="size-3.5" /> },
    { id: "npc", label: "AI NPCs", icon: <Bot className="size-3.5" /> },
    { id: "tournament", label: "Tournament", icon: <Target className="size-3.5" /> },
    { id: "party", label: "Party System", icon: <PartyPopper className="size-3.5" /> },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyGame"
        description="Multiplayer game backend — matchmaking, server-authoritative state sync @20fps, AI NPCs, tournaments, replay system"
      />

      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4" key={tick}>
        {activeTab === "match" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match control</h3>
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                {!matchId && !matchResult && (
                  <button type="button" onClick={handleQuickMatch} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90">
                    <Play className="mr-1 inline size-3.5" /> Quick match (4 players)
                  </button>
                )}
                {matchId && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Match active: {matchId}</span>
                    </div>
                    <button type="button" onClick={handleSimulate} className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                      Simulate 20 ticks
                    </button>
                    <button type="button" onClick={handleEndMatch} className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700">
                      <Square className="mr-1 inline size-3.5" /> End match
                    </button>
                  </>
                )}
                {matchResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-2 text-sm">
                      <Trophy className="size-4 text-green-500" />
                      <span className="font-semibold">Winner: {matchResult.winner || "Draw"}</span>
                    </div>
                    {Object.entries(matchResult.scores).map(([pid, score]) => (
                      <div key={pid} className="flex justify-between text-xs">
                        <span>{pid}</span>
                        <span className="font-bold tabular-nums">{score} pts</span>
                      </div>
                    ))}
                    <button type="button" onClick={() => { setMatchResult(null); handleQuickMatch(); }} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90">
                      New match
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Game design info</h3>
              <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
                <p>🎯 <span className="font-medium text-foreground">Server-authoritative</span> — DO @20fps tick, client @60fps interpolation</p>
                <p>⚠️ <span className="font-medium text-foreground">NO setAlarm()</span> — $810/DO/day at 60fps. Direct WebSocket loop only.</p>
                <p>🎮 <span className="font-medium text-foreground">Anti-cheat</span> — all decisions server-side, client sends input only</p>
                <p>📺 <span className="font-medium text-foreground">Spectator</span> — read-only WebSocket, same DO</p>
                <p>🔄 <span className="font-medium text-foreground">Replay</span> — journal of all inputs+events per tick</p>
                <p>🏆 <span className="font-medium text-foreground">ELO rating</span> — +25 win, -15 loss, dynamic adjustment</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab game={game} />}
        {activeTab === "npc" && <NPCTab game={game} />}
        {activeTab === "tournament" && <TournamentTab game={game} />}
        {activeTab === "party" && <PartyTab game={game} />}
      </div>
    </ConsoleShell>
  );
}

function LeaderboardTab({ game }: { game: FluxyGameApi }) {
  const board = game.getLeaderboard(10);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leaderboard</h3>
      <div className="space-y-1.5">
        {board.map((entry: GameLeaderboardEntry, i: number) => (
          <div key={entry.playerId} className={cn("flex items-center gap-3 rounded-lg border p-3", i === 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card")}>
            <span className="w-6 text-center text-lg">{i < 3 ? medals[i] : <span className="text-sm text-muted-foreground">#{i + 1}</span>}</span>
            <div className="flex-1"><span className="text-sm font-medium">{entry.username}</span></div>
            <div className="text-right"><div className="text-sm font-bold tabular-nums">{entry.score}</div><div className="text-[9px] uppercase text-muted-foreground">ELO</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NPCTab({ game }: { game: FluxyGameApi }) {
  const [npcs, setNpcs] = useState(() => [
    game.spawnNPC("Merlin", "friendly", 0.6),
    game.spawnNPC("Dragon Lord", "hostile", 0.8),
    game.spawnNPC("Shopkeeper", "merchant", 0.3),
  ]);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");

  const handleTalk = () => {
    if (!input.trim()) return;
    const resp = game.npcInteract(npcs[selected].id, "p1", input.trim());
    setResponse(resp);
    setInput("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI NPCs ({npcs.length})</h3>
        <div className="space-y-2">
          {npcs.map((npc, i) => (
            <button key={npc.id} type="button" onClick={() => setSelected(i)}
              className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left", selected === i ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-muted")}>
              <Bot className="size-4 text-muted-foreground" />
              <div className="flex-1"><div className="text-sm font-medium">{npc.name}</div><div className="text-[10px] text-muted-foreground">{npc.personality} · difficulty {(npc.difficulty * 100).toFixed(0)}%</div></div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talk to {npcs[selected]?.name}</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          {response && <div className="mb-3 rounded-lg bg-blue-500/10 p-2 text-sm"><span className="font-semibold text-blue-600">{npcs[selected].name}:</span> {response}</div>}
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleTalk()} placeholder="Say something..." className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={handleTalk} className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90">Talk</button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">NPCs remember your last interaction and reference it in future conversations.</p>
        </div>
      </div>
    </div>
  );
}

function TournamentTab({ game }: { game: FluxyGameApi }) {
  const [tourney, setTourney] = useState(() => {
    const t = game.createTournament("Summer Cup 2026", 8, "$500 + FluxyChat Pro Annual");
    return t;
  });

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tournament</h3>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div><h4 className="text-sm font-semibold">{tourney.name}</h4><p className="text-xs text-muted-foreground">Prize: {tourney.prize}</p></div>
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", tourney.status === "registration" ? "bg-blue-500/15 text-blue-600" : tourney.status === "active" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground")}>{tourney.status}</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{tourney.currentPlayers} / {tourney.maxPlayers} players registered</div>
        {tourney.rounds.length > 0 ? (
          <div className="mt-3 space-y-2">
            {tourney.rounds.map((round) => (
              <div key={round.round} className="rounded-lg border border-border p-2">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Round {round.round}</div>
                {round.matches.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1 text-xs">
                    <span className={cn("flex-1", m.winner === m.player1 && "font-bold text-green-600")}>{m.player1}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className={cn("flex-1 text-right", m.winner === m.player2 && "font-bold text-green-600")}>{m.player2}</span>
                    {m.winner && <Trophy className="size-3 text-amber-500" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Tournament starts when registration fills. Single elimination bracket.</p>
        )}
      </div>
    </div>
  );
}

function PartyTab({ game }: { game: FluxyGameApi }) {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [invites, setInvites] = useState<ReturnType<FluxyGameApi["inviteToParty"]>[]>([]);

  const handleCreate = () => {
    const id = game.createParty("p1");
    setPartyId(id);
  };

  const handleInvite = (toPlayer: string) => {
    if (!partyId) return;
    const inv = game.inviteToParty(partyId, "p1", toPlayer);
    setInvites([...invites, inv]);
  };

  const handleAccept = (inviteId: string) => {
    game.acceptPartyInvite(inviteId);
    setInvites(invites.filter((i) => i.id !== inviteId));
  };

  const party = partyId ? game.getParty(partyId) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party</h3>
        {!partyId ? (
          <button type="button" onClick={handleCreate} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"><Plus className="mr-1 inline size-3.5" /> Create party</button>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-medium">Party: {partyId}</div>
            <div className="mt-2 text-xs text-muted-foreground">Leader: {party?.leader}</div>
            <div className="mt-2"><div className="text-[10px] uppercase text-muted-foreground">Members</div>{party?.members.map((m) => (<div key={m} className="text-sm">{m}</div>))}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {["p2", "p3", "p4", "p5"].map((p) => (<button key={p} type="button" onClick={() => handleInvite(p)} className="rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80">Invite {p}</button>))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending invites ({invites.length})</h3>
        <div className="space-y-2">
          {invites.length === 0 ? <p className="text-sm text-muted-foreground">No pending invites</p> : invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs">
              <span>{inv.fromPlayer} → {inv.toPlayer}</span>
              <button type="button" onClick={() => handleAccept(inv.id)} className="ml-auto rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-500/25">Accept</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
