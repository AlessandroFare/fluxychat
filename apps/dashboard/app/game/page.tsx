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
  createWorkerFluxyGameClient,
  type MatchResult,
  type WorkerFluxyGameClient,
} from "@fluxy-chat/sdk";

export default function FluxyGamePage() {
  const chatClient = useWorkerChatClient("game-demo");
  const workerGame = useMemo(
    () => (chatClient ? createWorkerFluxyGameClient(chatClient) : null),
    [chatClient],
  );
  const [activeTab, setActiveTab] = useState<"match" | "leaderboard" | "npc" | "quests" | "tournament" | "party">("match");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [workerMatchId, setWorkerMatchId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [workerTick, setWorkerTick] = useState(0);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<Array<{ id: string; gameMode: string; state: string; players: string[] }>>([]);
  const autoStarted = useRef(false);

  useEffect(() => {
    autoStarted.current = true;
  }, []);

  useEffect(() => {
    if (!workerGame) return;
    void workerGame.listLobbies({ state: "waiting" }).then(setLobbies).catch(() => setLobbies([]));
  }, [workerGame, workerMatchId]);

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

    setWorkerError("Sign in so matchmake hits D1. Local createFluxyGame() is not a production match.");
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

    setWorkerError("No Worker match. Local tickMatch() is not production.");
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

    setWorkerError("No Worker match to end.");
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
        description="Matchmaking, authoritative ticks, D1 leaderboards and checkpoints. Not a netcode engine."
        actions={<WorkerBackendBadge connected={workerConnected} label="FluxyGame" />}
      />

      <ConsoleProjectRoomBar
        requireProject
        hint={workerConnected ? "Matches, ticks, and leaderboards persist to D1. Not a dedicated game server or rollback netcode." : "Sign in so matchmaking hits your Worker D1 tables."}
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
              <div className="space-y-3 rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
                {workerError ? (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{workerError}</p>
                ) : null}
                {workerGame && lobbies.length > 0 ? (
                  <div className="rounded-lg border border-border p-2 text-xs">
                    <div className="mb-1 text-[10px] uppercase text-muted-foreground">Waiting lobbies (Colyseus joinById / Nakama ListMatches)</div>
                    {lobbies.map((lobby) => (
                      <button
                        key={lobby.id}
                        type="button"
                        disabled={workerBusy}
                        onClick={() => {
                          void (async () => {
                            setWorkerBusy(true);
                            try {
                              await workerGame.joinLobby(lobby.id, "p1");
                              const refreshed = await workerGame.listLobbies({ state: "waiting" });
                              setLobbies(refreshed);
                            } catch (err) {
                              setWorkerError(err instanceof Error ? err.message : "joinLobby failed");
                            } finally {
                              setWorkerBusy(false);
                            }
                          })();
                        }}
                        className="mt-1 w-full rounded bg-muted px-2 py-1 text-left hover:bg-muted/80 disabled:opacity-50"
                      >
                        {lobby.id} · {lobby.players.length} players · {lobby.gameMode}
                      </button>
                    ))}
                  </div>
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
              <div className="space-y-2 rounded-xl bg-card shadow-[var(--shadow-2)] p-4 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Authoritative tick</span>: `submitInput` writes D1 and fans out `game.tick` on the lobby room. Not 60fps netcode.</p>
                <p><span className="font-medium text-foreground">Reconnect</span>: `getMatch` returns the D1 snapshot. No Colyseus seat token.</p>
                <p><span className="font-medium text-foreground">Anti-cheat</span>: the Worker applies input; the browser does not own the score.</p>
                <p><span className="font-medium text-foreground">Leaderboard</span>: `GET /games/leaderboard` on the project, not a local seed list.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab workerGame={workerGame} />}
        {activeTab === "npc" && <NPCTab workerGame={workerGame} />}
        {activeTab === "quests" && <QuestsTab workerGame={workerGame} />}
        {activeTab === "tournament" && <TournamentTab workerGame={workerGame} />}
        {activeTab === "party" && <PartyTab workerGame={workerGame} />}
      </div>
    </ConsoleShell>
  );
}

function LeaderboardTab({ workerGame }: { workerGame: WorkerFluxyGameClient | null }) {
  const [board, setBoard] = useState<Array<{ playerId: string; username: string; skillRating: number; rank: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerGame) return;
    void workerGame.listLeaderboard(10, "p1").then((rows) => {
      setBoard(rows.map((row) => ({
        playerId: row.playerId,
        username: row.username,
        skillRating: row.skillRating,
        rank: row.rank,
      })));
      setError(null);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Leaderboard failed");
    });
  }, [workerGame]);

  if (!workerGame) {
    return <p className="text-sm text-muted-foreground">Sign in to load the D1 leaderboard. Local seed scores are not production data.</p>;
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leaderboard · D1</h3>
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      <div className="space-y-1.5">
        {board.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows yet. Run a Worker match so upsertPlayer writes ratings.</p>
        ) : board.map((entry, i) => (
          <div key={entry.playerId} className={cn("flex items-center gap-3 rounded-lg border p-3", i === 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card")}>
            <span className="w-6 text-center text-sm text-muted-foreground">#{entry.rank || i + 1}</span>
            <div className="flex-1"><span className="text-sm font-medium">{entry.username}</span></div>
            <div className="text-right"><div className="text-sm font-bold tabular-nums">{entry.skillRating}</div><div className="text-[9px] uppercase text-muted-foreground">rating</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NPCTab({ workerGame }: { workerGame: WorkerFluxyGameClient | null }) {
  const [npcs, setNpcs] = useState<Array<{ id: string; name: string; personality: string; difficulty: number }>>([]);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateLimitSec, setRateLimitSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!workerGame) return;
    const list = await workerGame.listNpcs();
    setNpcs(list);
  }

  useEffect(() => {
    if (!workerGame) {
      setNpcs([]);
      return;
    }
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "listNpcs failed"));
  }, [workerGame]);

  const handleSeed = async () => {
    if (!workerGame) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all([
        workerGame.upsertNpc({ id: "npc_merlin", name: "Merlin", personality: "friendly", difficulty: 0.6 }),
        workerGame.upsertNpc({ id: "npc_dragon", name: "Dragon Lord", personality: "hostile", difficulty: 0.8 }),
        workerGame.upsertNpc({ id: "npc_merchant", name: "Shopkeeper", personality: "merchant", difficulty: 0.3 }),
      ]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "upsertNpc failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTalk = async () => {
    if (!input.trim() || !workerGame || !npcs[selected]) return;
    const message = input.trim();
    setInput("");
    setRateLimitSec(null);
    setBusy(true);
    try {
      const result = await workerGame.interactNpc(npcs[selected].id, { message, playerId: "p1" });
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
  };

  if (!workerGame) {
    return <p className="text-sm text-muted-foreground">Sign in so Talk hits `POST /games/npcs/:id/interact` (D1 memory + GAME_NPC_RATE_LIMIT_RPM). Local spawnNPC is not production.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI NPCs ({npcs.length}) · Worker D1
        </h3>
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        {npcs.length === 0 ? (
          <button type="button" onClick={() => void handleSeed()} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
            Upsert Merlin / Dragon / Shopkeeper
          </button>
        ) : (
          <div className="space-y-2">
            {npcs.map((npc, i) => (
              <button key={npc.id} type="button" onClick={() => setSelected(i)}
                className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left", selected === i ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-muted")}>
                <Bot className="size-4 text-muted-foreground" />
                <div className="flex-1"><div className="text-sm font-medium">{npc.name}</div><div className="text-[10px] text-muted-foreground">{npc.personality} · difficulty {(npc.difficulty * 100).toFixed(0)}% · rate-limited</div></div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talk to {npcs[selected]?.name || "—"}</h3>
        <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
          {rateLimitSec ? (
            <div className="mb-3 rounded-lg bg-amber-500/10 p-2 text-sm text-amber-700">
              Rate limited. Retry in {rateLimitSec}s
            </div>
          ) : null}
          {response && !rateLimitSec ? (
            <div className="mb-3 rounded-lg bg-blue-500/10 p-2 text-sm">
              <span className="font-semibold text-blue-600">{npcs[selected]?.name}:</span> {response}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handleTalk()} placeholder="Say something..." className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" disabled={busy || npcs.length === 0} />
            <button type="button" onClick={() => void handleTalk()} disabled={busy || npcs.length === 0} className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Talk"}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Replies persist NPC memory in D1. Template lines, not an LLM.
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
        setNote("Checkpoint version conflict. Reload before save.");
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
      <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
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
      <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
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

function TournamentTab({ workerGame }: { workerGame: WorkerFluxyGameClient | null }) {
  const [workerTourney, setWorkerTourney] = useState<{
    id: string; name: string; status: string; prize: string;
    currentPlayers: number; maxPlayers: number;
    rounds: Array<{ round: number; matches: Array<{ id: string; player1: string; player2: string; winner: string | null }> }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!workerGame) {
      setWorkerTourney(null);
      return;
    }
    void workerGame.listTournaments().then((rows) => {
      const first = rows[0];
      if (!first) return;
      setWorkerTourney({
        id: first.id,
        name: first.name,
        status: first.status,
        prize: first.prize,
        currentPlayers: first.currentPlayers,
        maxPlayers: first.maxPlayers,
        rounds: Array.isArray(first.rounds)
          ? first.rounds as Array<{ round: number; matches: Array<{ id: string; player1: string; player2: string; winner: string | null }> }>
          : [],
      });
    }).catch(() => setWorkerTourney(null));
  }, [workerGame]);

  const display = workerTourney;

  if (!workerGame) {
    return <p className="text-sm text-muted-foreground">Sign in so brackets live in D1 (`POST /games/tournaments`). Local createTournament is not production.</p>;
  }

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

  const handleJoin = async () => {
    if (!workerGame || !workerTourney) return;
    setBusy(true);
    try {
      const updated = await workerGame.joinTournament(workerTourney.id, "p5");
      setWorkerTourney({ ...workerTourney, ...updated, currentPlayers: workerTourney.currentPlayers + 1 });
      setNote("Joined tournament (Nakama JoinTournament HOW).");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Join tournament failed");
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
        Tournament · Worker D1
      </h3>
      {workerGame && !workerTourney ? (
        <button type="button" onClick={() => void handleWorkerCreate()} disabled={busy}
          className="mb-3 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
          Create & start on Worker
        </button>
      ) : null}
      {workerGame && workerTourney ? (
        <button type="button" onClick={() => void handleJoin()} disabled={busy}
          className="mb-3 ml-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
          Join as p5
        </button>
      ) : null}
      {note ? <p className="mb-2 text-xs text-muted-foreground">{note}</p> : null}
      {!display ? (
        <p className="text-sm text-muted-foreground">Create a tournament on the Worker to persist the bracket in D1.</p>
      ) : (
      <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
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
      )}
    </div>
  );
}

function PartyTab({ workerGame }: { workerGame: WorkerFluxyGameClient | null }) {
  const [party, setParty] = useState<{ id: string; members: string[]; leaderId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerGame) return;
    void workerGame.listParties().then((parties) => {
      if (parties[0]) setParty(parties[0]);
    }).catch(() => {});
  }, [workerGame]);

  const handleCreate = async () => {
    if (!workerGame) return;
    setBusy(true);
    setError(null);
    try {
      const created = await workerGame.createParty({ leaderId: "p1", roomId: "game-demo" });
      setParty(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create party failed");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (toPlayer: string) => {
    if (!workerGame || !party) return;
    setBusy(true);
    try {
      const updated = await workerGame.joinParty(party.id, toPlayer);
      setParty({ ...updated, leaderId: party.leaderId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join party failed");
    } finally {
      setBusy(false);
    }
  };

  if (!workerGame) {
    return <p className="text-sm text-muted-foreground">Sign in to create a D1 party (`POST /games/parties`). Local invite lists are not production data.</p>;
  }

  return (
    <div className="max-w-md">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party · D1</h3>
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      {!party ? (
        <button type="button" onClick={() => void handleCreate()} disabled={busy} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"><Plus className="mr-1 inline size-3.5" /> Create party</button>
      ) : (
        <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
          <div className="text-sm font-medium">Party: {party.id}</div>
          <div className="mt-2 text-xs text-muted-foreground">Leader: {party.leaderId}</div>
          <div className="mt-2"><div className="text-[10px] uppercase text-muted-foreground">Members</div>{party.members.map((m) => (<div key={m} className="text-sm">{m}</div>))}</div>
          <div className="mt-3 flex flex-wrap gap-1">
            {["p2", "p3", "p4"].filter((p) => !party.members.includes(p)).map((p) => (
              <button key={p} type="button" onClick={() => void handleInvite(p)} disabled={busy} className="rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80 disabled:opacity-50">Join {p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
