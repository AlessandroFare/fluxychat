import { useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

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
            workerUrl,
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

function ChatPanel({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionState, stopAgentStream } = useChat({
    roomId,
    markReadLatest: true,
  });
  const [draft, setDraft] = useState("");
  const isStreaming = messages.some((m) => m.streaming);

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <strong>{roomId}</strong>
        <span className="status">{connectionState.status}</span>
        {isStreaming ? (
          <button type="button" onClick={() => stopAgentStream()}>
            Stop
          </button>
        ) : null}
      </header>
      <ul className="messages">
        {messages.map((m) => (
          <li key={m.id} className="message">
            <span className="author">{m.userId}</span>
            <span>{m.content}</span>
          </li>
        ))}
      </ul>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          void sendMessage(text);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message, or @assistant to mention the room agent"
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
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
        <h1>FluxyChat — chat-only starter</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and set{" "}
          <code>VITE_FLUXYCHAT_WORKER_URL</code>.
        </p>
        <p>
          Then either <code>VITE_FLUXYCHAT_MEMBER_JWT</code> (member) or{" "}
          <code>VITE_FLUXYCHAT_PUBLIC_ROOM_ID</code> (guest, ~60s to first message).
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
        <h1>FluxyChat</h1>
        <p className="error">{error ?? "Set JWT or public room ID in .env"}</p>
        <p>
          Get credentials from{" "}
          <a href="https://fluxychat.com/onboarding" target="_blank" rel="noreferrer">
            onboarding
          </a>{" "}
          or use a public room ID for guest mode.
        </p>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>FluxyChat</h1>
      <p className="mode-badge">{session.mode === "guest" ? "Guest session" : "Member JWT"}</p>
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
        <ChatPanel roomId={activeRoomId} />
      </FluxyRealtimeProvider>
    </main>
  );
}
