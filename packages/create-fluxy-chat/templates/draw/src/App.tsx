import { useEffect, useState } from "react";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

interface Dot {
  x: number;
  y: number;
  color: string;
}

function DrawBoard({ roomId, selfUserId }: { roomId: string; selfUserId: string }) {
  const { liveCursors, sendCursor, sendClientEvent, lastClientEvent, connected } = useChat({
    roomId,
    replay: "request",
  });
  const [dots, setDots] = useState<Dot[]>([]);

  useEffect(() => {
    if (!lastClientEvent || lastClientEvent.eventName !== "client-ephemeral-dot") return;
    if (lastClientEvent.userId === selfUserId) return;
    const data = lastClientEvent.data;
    if (!data || typeof data !== "object") return;
    const rec = data as { x?: number; y?: number; color?: string };
    const x = Number(rec.x);
    const y = Number(rec.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setDots((prev) => [...prev, { x, y, color: String(rec.color ?? "#2563eb") }]);
  }, [lastClientEvent, selfUserId]);

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Draw · {roomId}</strong>
        <span className="status">{connected ? "live" : "connecting"} — click to stamp, move for cursors</span>
      </header>
      <div
        className="canvas"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          sendCursor({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            color: "#db2777",
            label: selfUserId.slice(0, 12),
          });
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          sendClientEvent("client-ephemeral-dot", { x, y, color: "#2563eb" });
          setDots((prev) => [...prev, { x, y, color: "#2563eb" }]);
        }}
      >
        {dots.map((dot, i) => (
          <span key={i} className="dot" style={{ left: dot.x, top: dot.y, background: dot.color }} />
        ))}
        {Object.values(liveCursors)
          .filter((c) => c.userId !== selfUserId)
          .map((cursor) => (
            <div
              key={cursor.userId}
              className="peer-cursor"
              style={{ left: cursor.x, top: cursor.y, color: cursor.color || "#0f172a" }}
            >
              <span>{cursor.label || cursor.userId.slice(0, 8)}</span>
            </div>
          ))}
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
      <p className="mode-badge">
        {session.mode} · cursors are type &quot;cursor&quot;; stamps are client-ephemeral-dot. Open two tabs.
      </p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <DrawBoard roomId={session.roomId} selfUserId={session.userId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
