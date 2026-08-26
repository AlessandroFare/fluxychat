import { useState } from "react";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { AvatarStack } from "@fluxy-chat/ui";
import { useFluxySession, workerUrl } from "./session";

const agentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim();

function WarRoom({ roomId }: { roomId: string }) {
  const {
    messages,
    sendMessage,
    invokeAgent,
    connected,
    presenceMembers,
    sendPresencePatch,
    livePresence,
    agentTyping,
  } = useChat({ roomId, replay: "request" });
  const [draft, setDraft] = useState("");

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    sendPresencePatch({ agentStatus: "briefing" });
    if (agentId) {
      try {
        await invokeAgent(text, { agentId });
      } catch (err) {
        await sendMessage(`[agent unavailable] ${text}`);
        console.error(err);
      }
    } else {
      await sendMessage(text);
    }
    sendPresencePatch({ agentStatus: null });
  }

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>War room · {roomId}</strong>
        <span className="status">
          {connected ? "live" : "connecting"} · {presenceMembers.length} here
          {agentTyping ? " · agent typing" : ""}
        </span>
      </header>
      <div className="roster" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AvatarStack people={presenceMembers.map((m) => ({ userId: m.userId }))} />
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {presenceMembers.map((m) => (
            <li key={m.userId}>
              {m.userId}
              {livePresence[m.userId]?.agentStatus
                ? ` · ${String(livePresence[m.userId]?.agentStatus)}`
                : ""}
            </li>
          ))}
        </ul>
      </div>
      <div className="log">
        {messages.map((msg) => (
          <p key={msg.id}>
            <strong>{msg.userId}:</strong> {msg.content}
          </p>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={agentId ? "Brief the agent…" : "Chat (set VITE_FLUXYCHAT_AGENT_ID to invoke)"}
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}

export function App() {
  const { session, loading, error } = useFluxySession();

  if (!workerUrl) {
    return (
      <div className="shell">
        <p>Set <code>VITE_FLUXYCHAT_WORKER_URL</code>.</p>
      </div>
    );
  }
  if (loading) return <div className="shell">Starting…</div>;
  if (error) return <div className="shell error">{error}</div>;
  if (!session) {
    return (
      <div className="shell">
        <p>Set a member JWT or public room id.</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <p className="mode-badge">
        {session.mode} · same room WebSocket as chat + presence. Not MQTT. Open two tabs.
      </p>
      <FluxyRealtimeProvider
        workerUrl={session.workerUrl}
        authTokenProvider={session.token}
        userId={session.userId}
      >
        <WarRoom roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
