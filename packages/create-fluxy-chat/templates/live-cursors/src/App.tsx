import { useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

const CURSOR_COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];

interface FluxySession {
  workerUrl: string;
  token: string;
  userId: string;
  roomId: string;
  mode: "member" | "guest";
}

function useFluxySession(): {
  session: FluxySession | null;
  loading: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<FluxySession | null>(null);
  const [loading, setLoading] = useState(Boolean(workerUrl));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerUrl) {
      setLoading(false);
      return;
    }

    if (memberJwt) {
      setSession({
        workerUrl,
        token: memberJwt,
        userId: "demo-user",
        roomId: configuredRoomId,
        mode: "member",
      });
      setLoading(false);
      return;
    }

    if (publicRoomId) {
      let cancelled = false;
      void FluxyChatClient.joinPublicRoomAsGuest(workerUrl, publicRoomId, {
        displayName: "Guest",
      })
        .then((guest) => {
          if (cancelled) return;
          setSession({
            workerUrl: workerUrl,
            token: guest.token,
            userId: guest.userId,
            roomId: guest.roomId,
            mode: "guest",
          });
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Guest session failed");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setLoading(false);
  }, []);

  return { session, loading, error };
}

function CursorCanvas({
  roomId,
  selfUserId,
}: {
  roomId: string;
  selfUserId: string;
}) {
  const { liveCursors, sendCursor, connected, connectionState } = useChat({
    roomId,
    replay: "request",
  });
  const color = CURSOR_COLORS[Math.abs(hashCode(selfUserId)) % CURSOR_COLORS.length];

  return (
    <section className="canvas-wrap">
      <header className="chat-header">
        <strong>{roomId}</strong>
        <span className="status">
          {connected ? "live" : connectionState.status} — open a second tab
        </span>
      </header>
      <div
        className="canvas"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          sendCursor({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            color,
            label: selfUserId.slice(0, 12),
          });
        }}
        onPointerLeave={() => {
          /* last position stays until stale on peers */
        }}
      >
        {Object.values(liveCursors)
          .filter((c) => c.userId !== selfUserId)
          .map((cursor) => (
            <div
              key={cursor.userId}
              className="peer-cursor"
              style={{
                left: cursor.x,
                top: cursor.y,
                color: cursor.color || "#2563eb",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M5.5 3.2 19 12.4l-6.2 1.4 2.6 6.6-2.8 1.1-2.6-6.6L5.5 3.2Z"
                  fill="currentColor"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
              </svg>
              <span>{cursor.label || cursor.userId}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}

export function App() {
  const { session, loading, error } = useFluxySession();
  const [roomId, setRoomId] = useState(configuredRoomId);

  const activeRoomId = useMemo(() => {
    if (session?.mode === "guest") return session.roomId;
    return roomId.trim() || configuredRoomId;
  }, [session, roomId]);

  if (!workerUrl) {
    return (
      <main className="shell">
        <h1>FluxyChat — live cursors</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and set{" "}
          <code>VITE_FLUXYCHAT_WORKER_URL</code>.
        </p>
        <p>
          Then either <code>VITE_FLUXYCHAT_MEMBER_JWT</code> or{" "}
          <code>VITE_FLUXYCHAT_PUBLIC_ROOM_ID</code>.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <p>Connecting…</p>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="shell">
        <h1>Live cursors</h1>
        <p className="error">{error ?? "Set JWT or public room ID in .env"}</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>Live cursors</h1>
      <p className="mode-badge">
        {session.mode === "guest" ? "Guest session" : "Member JWT"} — two tabs, same room
      </p>
      {session.mode === "member" ? (
        <label className="room-picker">
          Room
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        </label>
      ) : null}
      <FluxyRealtimeProvider
        workerUrl={session.workerUrl}
        authTokenProvider={session.token}
        userId={session.userId}
      >
        <CursorCanvas roomId={activeRoomId} selfUserId={session.userId} />
      </FluxyRealtimeProvider>
    </main>
  );
}
