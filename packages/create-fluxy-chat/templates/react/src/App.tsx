import { useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL;
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT;
const defaultRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID || "demo";

function ChatPanel({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionState } = useChat({
    roomId,
    markReadLatest: true,
  });
  const [draft, setDraft] = useState("");

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <strong>{roomId}</strong>
        <span className="status">{connectionState.status}</span>
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
          placeholder="Type a message…"
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}

export function App() {
  const [roomId, setRoomId] = useState(defaultRoomId);

  const client = useMemo(() => {
    if (!workerUrl?.trim() || !memberJwt?.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.trim(),
      userId: "demo-user",
      token: memberJwt.trim(),
    });
  }, []);

  if (!client) {
    return (
      <main className="shell">
        <h1>FluxyChat — chat-only starter</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and set{" "}
          <code>VITE_FLUXYCHAT_WORKER_URL</code> and <code>VITE_FLUXYCHAT_MEMBER_JWT</code>.
        </p>
        <p>
          Get credentials from{" "}
          <a href="https://fluxychat.com/onboarding" target="_blank" rel="noreferrer">
            onboarding
          </a>{" "}
          or <code>pnpm run first-message</code> in the monorepo.
        </p>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>FluxyChat</h1>
      <label className="room-picker">
        Room
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
      </label>
      <FluxyRealtimeProvider client={client}>
        <ChatPanel roomId={roomId.trim() || defaultRoomId} />
      </FluxyRealtimeProvider>
    </main>
  );
}
