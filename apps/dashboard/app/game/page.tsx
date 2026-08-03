"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Gamepad2, Users, Trophy, Play, Square, Eye, Bot,
  PartyPopper, Swords, Target, Skull, Heart, Zap, Loader2, Plus,
} from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { ConsoleProjectRoomBar } from "@/app/components/console-project-room-bar";
import { WorkerBackendBadge } from "@/app/components/worker-backend-badge";
import { cn } from "@/lib/utils";
import { useWorkerChatClient } from "@/lib/use-worker-chat-client";
import {
  createFluxyGame,
  createWorkerFluxyGameClient,
  type FluxyGameApi,
  type MatchResult,
  type WorkerFluxyGameClient,
} from "@fluxy-chat/sdk";

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
  const chatClient = useWorkerChatClient("game-demo");
  const workerGame = useMemo(
    () => (chatClient ? createWorkerFluxyGameClient(chatClient) : null),
    [chatClient],
  );
  const [game] = useState<FluxyGameApi | null>(createSeededGame());
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"match" | "leaderboard" | "npc" | "quests" | "tournament" | "party">("match");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [workerMatchId, setWorkerMatchId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [workerTick, setWorkerTick] = useState(0);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [spectating, setSpectating] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!game || autoStarted.current) return;
    autoStarted.current = true;
    const id = game.findMatch("p1", "deathmatch", 4);
    game.findMatch("p2", "deathmatch", 4);
    game.findMatch("p3", "deathmatch", 4);
    game.findMatch("p4", "deathmatch", 4);
    if (id) {
      const mid = game.startMatch(id);
      if (!mid) return;
      setMatchId(mid);
      for (let i = 0; i < 10; i++) {
        const playerId = ["p1", "p2", "p3", "p4"][i % 4]!;
        game.processInput(mid, {
          tick: i, playerId, sequence: i,
          actions: i % 3 === 0
            ? [{ type: "shoot", payload: { targetId: ["p1", "p2", "p3", "p4"].filter((p) => p !== playerId)[i % 3] } }]
            : [{ type: "move", payload: { dx: Math.random() - 0.5, dy: Math.random() - 0.5 } }],
        });
        game.tickMatch(mid);
      }
      setTick(10);
    }
  }, [game]);

  if (!game) return null;

  const activeMatchId = workerMatchId ?? matchId;
  const workerConnected = Boolean(workerGame);

  const handleQuickMatch = async () => {
    if (workerGame) {
      setWorkerBusy(true);
      setWorkerError(null);
      setMatchResult(null);
      try {
        await workerGame.upsertPlayer({ playerId: "p1", username: "Alice", skillRating: 1200 });
        await workerGame.upsertPlayer({ playerId: "p2", username: "Bob", skillRating: 1150 });
        await workerGame.upsertPlayer({ playerId: "p3", username: "Charlie", skillRating: 1300 });
        await workerGame.upsertPlayer({ playerId: "p4", username: "Diana", skillRating: 950 });
        const { lobbyId } = await workerGame.matchmake({ gameMode: "deathmatch", playerId: "p1" });
        await workerGame.matchmake({ gameMode: "deathmatch", playerId: "p2" });
        await workerGame.matchmake({ gameMode: "deathmatch", playerId: "p3" });
        await workerGame.matchmake({ gameMode: "deathmatch", playerId: "p4" });
        const { matchId: mid } = await workerGame.startMatch(lobbyId);
        setWorkerMatchId(mid);
        setMatchId(null);
      } catch (err) {
        setWorkerError(err instanceof Error ? err.message : "Worker match failed");
      } finally {
        setWorkerBusy(false);
      }
      return;
    }

    const id1 = game.findMatch("p1", "deathmatch", 4);
    game.findMatch("p2", "deathmatch", 4);
    game.findMatch("p3", "deathmatch", 4);
    game.findMatch("p4", "deathmatch", 4);
    if (id1) {
      const mid = game.startMatch(id1);
      setMatchId(mid);
      setWorkerMatchId(null);
      setMatchResult(null);
    }
  };

  const handleSimulate = async () => {
    if (workerGame && workerMatchId) {
      setWorkerBusy(true);
      try {
        for (let i = 0; i < 20; i++) {
          const playerId = ["p1", "p2", "p3", "p4"][i % 4];
          await workerGame.submitInput(workerMatchId, {
            tick: i,
            playerId,
            sequence: i,
            actions: i % 3 === 0
              ? [{ type: "shoot", payload: { targetId: "p2" } }]
              : [{ type: "move", payload: { dx: 0.1, dy: 0.1 } }],
          });
        }
        setWorkerTick((v) => v + 1);
      } catch (err) {
        setWorkerError(err instanceof Error ? err.message : "Worker simulate failed");
      } finally {
        setWorkerBusy(false);
      }
      return;
    }

    if (!matchId) return;
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
    setTick((v) => v + 1);
  };

  const handleEndMatch = async () => {
    if (workerGame && workerMatchId) {
      setWorkerBusy(true);
      try {
        await workerGame.endMatch(workerMatchId, {
          matchId: workerMatchId,
          winner: "p1",
          duration: 120,
          scores: { p1: 10, p2: 6, p3: 4, p4: 2 },
          mvp: "p1",
          events: [],
        });
        setMatchResult({
          matchId: workerMatchId,
          winner: "p1",
          duration: 120,
          scores: { p1: 10, p2: 6, p3: 4, p4: 2 },
          mvp: "p1",
          events: [],
        });
        setWorkerMatchId(null);
      } catch (err) {
        setWorkerError(err instanceof Error ? err.message : "Worker end failed");
      } finally {
        setWorkerBusy(false);
      }
      return;
    }

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
    { id: "quests", label: "Quests & Saves", icon: <Target className="size-3.5" /> },
    { id: "tournament", label: "Tournament", icon: <Trophy className="size-3.5" /> },
    { id: "party", label: "Party System", icon: <PartyPopper className="size-3.5" /> },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyGame"
        description="Multiplayer game backend — matchmaking, server-authoritative state sync @20fps, AI NPCs, tournaments, replay system"
        actions={<WorkerBackendBadge connected={workerConnected} label="FluxyGame" />}
      />

      <ConsoleProjectRoomBar
        requireProject
        hint={workerConnected ? "Matches and leaderboards persist to D1 on your Worker." : "Sign in to run matchmaking against your Worker; local demo runs in-memory otherwise."}
      />

      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "match" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match control</h3>
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                {workerError ? (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{workerError}</p>
                ) : null}
                {!activeMatchId && !matchResult && (
                  <button type="button" onClick={() => void handleQuickMatch()} disabled={workerBusy} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                    {workerBusy ? <Loader2 className="mr-1 inline size-3.5 animate-spin" /> : <Play className="mr-1 inline size-3.5" />}
                    Quick match (4 players){workerConnected ? " · Worker" : ""}
                  </button>
                )}
                {activeMatchId && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Match active: {activeMatchId}</span>
                      {workerMatchId ? <span className="text-[10px] uppercase text-muted-foreground">D1 persisted</span> : null}
                    </div>
                    <button type="button" onClick={() => void handleSimulate()} disabled={workerBusy} className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
                      Simulate 20 ticks
                    </button>
                    <button type="button" onClick={() => void handleEndMatch()} disabled={workerBusy} className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
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
        {activeTab === "npc" && <NPCTab game={game} workerGame={workerGame} />}
        {activeTab === "quests" && <QuestsTab workerGame={workerGame} />}
        {activeTab === "tournament" && <TournamentTab game={game} workerGame={workerGame} />}
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

function NPCTab({ game, workerGame }: { game: FluxyGameApi; workerGame: WorkerFluxyGameClient | null }) {
  const [npcs, setNpcs] = useState(() => [
    game.spawnNPC("Merlin", "friendly", 0.6),
    game.spawnNPC("Dragon Lord", "hostile", 0.8),
    game.spawnNPC("Shopkeeper", "merchant", 0.3),
  ]);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [workerNpcIds, setWorkerNpcIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateLimitSec, setRateLimitSec] = useState<number | null>(null);
  const seededWorker = useRef(false);

  useEffect(() => {
    if (!workerGame || seededWorker.current) return;
    seededWorker.current = true;
    void (async () => {
      try {
        let list = await workerGame.listNpcs();
        if (list.length === 0) {
          await Promise.all([
            workerGame.upsertNpc({ id: "npc_merlin", name: "Merlin", personality: "friendly", difficulty: 0.6 }),
            workerGame.upsertNpc({ id: "npc_dragon", name: "Dragon Lord", personality: "hostile", difficulty: 0.8 }),
            workerGame.upsertNpc({ id: "npc_merchant", name: "Shopkeeper", personality: "merchant", difficulty: 0.3 }),
          ]);
          list = await workerGame.listNpcs();
        }
        setWorkerNpcIds(list.map((n) => n.id));
      } catch {
        setWorkerNpcIds([]);
      }
    })();
  }, [workerGame]);

  const handleTalk = async () => {
    if (!input.trim()) return;
    const message = input.trim();
    setInput("");
    setRateLimitSec(null);

    if (workerGame && workerNpcIds[selected]) {
      setBusy(true);
      try {
        const result = await workerGame.interactNpc(workerNpcIds[selected], { message, playerId: "p1" });
        if (result.retryAfterSeconds) {
          setRateLimitSec(result.retryAfterSeconds);
          setResponse("");
          return;
        }
        setResponse(result.reply);
      } catch (err) {
        setResponse(err instanceof Error ? err.message : "Worker NPC failed");
      } finally {
        setBusy(false);
      }
      return;
    }

    const resp = game.npcInteract(npcs[selected].id, "p1", message);
    setResponse(resp);
  };

  const displayNpcs = workerGame && workerNpcIds.length > 0
    ? npcs.slice(0, workerNpcIds.length).map((n, i) => ({ ...n, id: workerNpcIds[i] ?? n.id, workerBacked: true }))
    : npcs.map((n) => ({ ...n, workerBacked: false }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI NPCs ({displayNpcs.length}){workerGame ? " · Worker D1" : " · local demo"}
        </h3>
        <div className="space-y-2">
          {displayNpcs.map((npc, i) => (
            <button key={npc.id} type="button" onClick={() => setSelected(i)}
              className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left", selected === i ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-muted")}>
              <Bot className="size-4 text-muted-foreground" />
              <div className="flex-1"><div className="text-sm font-medium">{npc.name}</div><div className="text-[10px] text-muted-foreground">{npc.personality} · difficulty {(npc.difficulty * 100).toFixed(0)}%{npc.workerBacked ? " · rate-limited" : ""}</div></div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talk to {displayNpcs[selected]?.name}</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          {rateLimitSec ? (
            <div className="mb-3 rounded-lg bg-amber-500/10 p-2 text-sm text-amber-700">
              Rate limited — retry in {rateLimitSec}s
            </div>
          ) : null}
          {response && !rateLimitSec ? (
            <div className="mb-3 rounded-lg bg-blue-500/10 p-2 text-sm">
              <span className="font-semibold text-blue-600">{displayNpcs[selected]?.name}:</span> {response}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handleTalk()} placeholder="Say something..." className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" disabled={busy} />
            <button type="button" onClick={() => void handleTalk()} disabled={busy} className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Talk"}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {workerGame
              ? "Worker-backed NPCs use D1 memory and per-player rate limits (GAME_NPC_RATE_LIMIT_RPM)."
              : "NPCs remember your last interaction and reference it in future conversations."}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestsTab({ workerGame }: { workerGame: WorkerFluxyGameClient | null }) {
  const gameRoomId = "game-demo";
  const [quests, setQuests] = useState<Array<{ id: string; title: string; moderationStatus: string }>>([]);
  const [title, setTitle] = useState("Find the ancient key");
  const [checkpoint, setCheckpoint] = useState<{ version: number; state: Record<string, unknown> } | null>(null);
  const [crdtMerged, setCrdtMerged] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [federateTargetRoomId, setFederateTargetRoomId] = useState("game-federated");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!workerGame) return;
    void workerGame.listQuests().then(setQuests).catch(() => setQuests([]));
    void workerGame.getCheckpoint("demo-level", undefined, { roomId: gameRoomId, crdt: true }).then((row) => {
      if (row) {
        setCheckpoint({ version: row.version, state: row.state });
        setCrdtMerged(true);
      }
    }).catch(() => {});
  }, [workerGame]);

  const handleCreateQuest = async () => {
    if (!workerGame || !title.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await workerGame.createQuest({
        title: title.trim(),
        roomId: gameRoomId,
        objectives: [{ id: "key", label: "Collect key" }],
      });
      setNote(result.pendingModeration ? "Quest held for moderation (blocked keywords)." : "Quest approved and fan-out ready.");
      const list = await workerGame.listQuests();
      setQuests(list);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Create quest failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCheckpoint = async () => {
    if (!workerGame) return;
    setBusy(true);
    setConflict(false);
    setNote(null);
    const nextState = {
      level: 3,
      hp: Math.floor(Math.random() * 40) + 60,
      coins: Math.floor(Math.random() * 20) + 5,
    };
    try {
      const result = await workerGame.upsertCheckpoint({
        checkpointKey: "demo-level",
        state: nextState,
        expectedVersion: checkpoint?.version,
        roomId: gameRoomId,
      });
      if (result.conflict) {
        setConflict(true);
        setNote("Checkpoint version conflict — reload before save.");
        setCheckpoint({ version: result.checkpoint.version, state: result.checkpoint.state });
        return;
      }
      setCheckpoint({ version: result.checkpoint.version, state: result.checkpoint.state });
      setNote(`Saved checkpoint v${result.checkpoint.version}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFederateCheckpoint = async () => {
    if (!workerGame || !federateTargetRoomId.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await workerGame.federateCheckpoint("demo-level", {
        sourceRoomId: gameRoomId,
        targetRoomId: federateTargetRoomId.trim(),
      });
      if (result.checkpoint) {
        setNote(`Federated checkpoint v${result.checkpoint.version} to room ${federateTargetRoomId.trim()}.`);
      } else {
        setNote("Checkpoint federated to target room.");
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Federate failed");
    } finally {
      setBusy(false);
    }
  };

  if (!workerGame) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to use Worker-backed cloud checkpoints and quest moderation.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cloud checkpoint</h3>
        {crdtMerged ? (
          <p className="mb-2 text-[10px] text-violet-600">Yjs CRDT merged from room {gameRoomId}</p>
        ) : null}
        <pre className="mb-3 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-[11px]">
          {checkpoint ? JSON.stringify(checkpoint, null, 2) : "{}"}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSaveCheckpoint()} disabled={busy}
            className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
            Save random state
          </button>
          <input
            value={federateTargetRoomId}
            onChange={(e) => setFederateTargetRoomId(e.target.value)}
            placeholder="Target room ID"
            className="min-w-[8rem] flex-1 rounded-lg border border-border bg-background px-2 py-2 text-xs"
          />
          <button type="button" onClick={() => void handleFederateCheckpoint()} disabled={busy || !federateTargetRoomId.trim()}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
            Federate to room
          </button>
        </div>
        {conflict ? <p className="mt-2 text-xs text-amber-600">Version conflict detected (optimistic concurrency).</p> : null}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quest moderation</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleCreateQuest()} disabled={busy}
          className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
          Create quest
        </button>
        <ul className="mt-3 space-y-1 text-sm">
          {quests.map((q) => (
            <li key={q.id} className="flex justify-between gap-2 rounded bg-muted/50 px-2 py-1">
              <span>{q.title}</span>
              <span className={cn("text-[10px] uppercase", q.moderationStatus === "approved" ? "text-green-600" : q.moderationStatus === "pending" ? "text-amber-600" : "text-red-600")}>
                {q.moderationStatus}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {note ? <p className="col-span-full text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function TournamentTab({ game, workerGame }: { game: FluxyGameApi; workerGame: WorkerFluxyGameClient | null }) {
  const [tourney, setTourney] = useState(() => {
    const t = game.createTournament("Summer Cup 2026", 8, "$500 + FluxyChat Pro Annual");
    return t;
  });
  const [workerTourney, setWorkerTourney] = useState<{
    id: string; name: string; status: string; prize: string;
    currentPlayers: number; maxPlayers: number;
    rounds: Array<{ round: number; matches: Array<{ id: string; player1: string; player2: string; winner: string | null }> }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const display = workerTourney ?? {
    id: tourney.id,
    name: tourney.name,
    status: tourney.status,
    prize: tourney.prize,
    currentPlayers: tourney.currentPlayers,
    maxPlayers: tourney.maxPlayers,
    rounds: tourney.rounds,
  };

  const handleWorkerCreate = async () => {
    if (!workerGame) return;
    setBusy(true);
    setNote(null);
    try {
      const created = await workerGame.createTournament({
        name: "Summer Cup 2026",
        maxPlayers: 8,
        prize: "$500 + FluxyChat Pro Annual",
        roomId: "game-demo",
        players: ["p1", "p2", "p3", "p4"],
      });
      const started = await workerGame.startTournament(created.id, { players: ["p1", "p2", "p3", "p4"] });
      setWorkerTourney(started as typeof workerTourney);
      setNote("Tournament created and started on Worker D1.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Worker tournament failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReportFirstMatch = async () => {
    if (!workerGame || !workerTourney?.rounds[0]?.matches[0]) return;
    setBusy(true);
    try {
      const match = workerTourney.rounds[0].matches[0];
      const updated = await workerGame.reportTournamentMatch(workerTourney.id, match.id, match.player1);
      setWorkerTourney(updated as typeof workerTourney);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Report match failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tournament{workerGame ? " · Worker D1" : " · local demo"}
      </h3>
      {workerGame && !workerTourney ? (
        <button type="button" onClick={() => void handleWorkerCreate()} disabled={busy}
          className="mb-3 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
          Create & start on Worker
        </button>
      ) : null}
      {note ? <p className="mb-2 text-xs text-muted-foreground">{note}</p> : null}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div><h4 className="text-sm font-semibold">{display.name}</h4><p className="text-xs text-muted-foreground">Prize: {display.prize}</p></div>
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", display.status === "registration" ? "bg-blue-500/15 text-blue-600" : display.status === "active" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground")}>{display.status}</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{display.currentPlayers} / {display.maxPlayers} players registered</div>
        {display.rounds.length > 0 ? (
          <div className="mt-3 space-y-2">
            {display.rounds.map((round) => (
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
        {workerGame && workerTourney?.rounds[0]?.matches.some((m) => !m.winner) ? (
          <button type="button" onClick={() => void handleReportFirstMatch()} disabled={busy}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
            Report first match winner
          </button>
        ) : null}
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
