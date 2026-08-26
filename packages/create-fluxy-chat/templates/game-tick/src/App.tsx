import { useMemo, useState } from "react";
import { createWorkerFluxyGameClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat, useFluxyChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

function GameBoard({ roomId, userId }: { roomId: string; userId: string }) {
  const { client } = useFluxyChat();
  const game = useMemo(() => (client ? createWorkerFluxyGameClient(client) : null), [client]);
  const [ticks, setTicks] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { connected } = useChat({
    roomId,
    replay: "request",
    onServerEvent: (ev) => {
      if (ev.name === "game.tick" || ev.name === "game.match_started") {
        setTicks((prev) => [`${ev.name} ${JSON.stringify(ev.data)}`, ...prev].slice(0, 40));
      }
    },
  });

  async function start() {
    if (!game) return;
    setError(null);
    try {
      const gameMode = `demo-${Date.now()}`;
      await game.matchmake({ playerId: userId, roomId, gameMode, maxPlayers: 2 });
      const lobby = await game.matchmake({
        playerId: `${userId}-cpu`,
        roomId,
        gameMode,
        maxPlayers: 2,
      });
      const match = await game.startMatch(lobby.lobbyId);
      setMatchId(match.matchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "match_failed");
    }
  }

  async function inputTick() {
    if (!game || !matchId) return;
    await game.submitInput(matchId, { playerId: userId, actions: { move: "nudge" } });
  }

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Game tick · {roomId}</strong>
        <span className="status">{connected ? "listening for game.tick" : "connecting"}</span>
      </header>
      <p className="hint">Not netcode. Matchmake binds this room, then input posts a server_event tick.</p>
      {error ? <p className="error" style={{ padding: "0 1rem" }}>{error}</p> : null}
      <ul className="readings">
        {ticks.length === 0 ? <li>No ticks yet.</li> : null}
        {ticks.map((row, i) => (
          <li key={`${i}-${row.slice(0, 24)}`}>{row}</li>
        ))}
      </ul>
      <div className="composer">
        <button type="button" className="primary" onClick={() => void start()}>
          Matchmake + start
        </button>
        <button type="button" className="primary" disabled={!matchId} onClick={() => void inputTick()}>
          Submit input
        </button>
      </div>
    </section>
  );
}

export function App() {
  const { session, loading, error } = useFluxySession();
  if (!workerUrl) return <div className="shell">Set <code>VITE_FLUXYCHAT_WORKER_URL</code>.</div>;
  if (loading) return <div className="shell">Starting…</div>;
  if (error) return <div className="shell error">{error}</div>;
  if (!session) return <div className="shell">Set a member JWT or public room id.</div>;

  return (
    <div className="shell">
      <p className="mode-badge">{session.mode} · server_event ticks, not rollback netcode</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <GameBoard roomId={session.roomId} userId={session.userId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
