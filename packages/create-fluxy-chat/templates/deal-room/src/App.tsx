import { useState } from "react";
import { FluxyRealtimeProvider, useChat, useFluxyChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

function DealBoard({ roomId }: { roomId: string }) {
  const { client } = useFluxyChat();
  const { messages, sendMessage, connected, invokeAgent } = useChat({ roomId, replay: "request" });
  const [draft, setDraft] = useState("Approve term sheet?");
  const [busy, setBusy] = useState(false);
  const agentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim();

  async function propose() {
    const content = draft.trim();
    if (!client || !content) return;
    setBusy(true);
    try {
      await client.createDecision(roomId, { content, requiredAcks: 2 });
      setDraft("");
    } catch (err) {
      console.error(err);
      await sendMessage(`[decision failed] ${content}`);
    } finally {
      setBusy(false);
    }
  }

  async function ack(messageId: number) {
    if (!client) return;
    setBusy(true);
    try {
      await client.ackDecision(messageId);
    } finally {
      setBusy(false);
    }
  }

  async function exportMarkdown() {
    if (!client) return;
    const blob = await client.exportRoomMarkdown(roomId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${roomId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function askAgent() {
    if (!agentId) return;
    setBusy(true);
    try {
      await invokeAgent(agentId, "Summarize this deal thread and list open decisions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Deal room · {roomId}</strong>
        <span className="status">{connected ? "live" : "connecting"} · quorum + export</span>
      </header>
      <p className="hint" style={{ margin: "0.75rem" }}>
        Cross-org invites stay on POST /cross-org (server). This demo is quorum acks on chat messages.
      </p>
      <div className="log">
        {messages.map((msg) => (
          <p key={msg.id}>
            <strong>{msg.userId}:</strong> {msg.content}
            {msg.decision ? (
              <>
                {" "}
                · quorum {msg.decision.totalCurrent}/{msg.decision.totalRequired}
                {msg.decision.quorumMet ? " met" : ""}
                {msg.decision.state === "pending" ? (
                  <button type="button" className="primary" style={{ marginLeft: 8 }} disabled={busy} onClick={() => void ack(msg.id)}>
                    Ack
                  </button>
                ) : null}
              </>
            ) : null}
          </p>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void propose();
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Decision text…" />
        <button type="submit" disabled={busy}>
          Propose
        </button>
        <button type="button" className="primary" onClick={() => void exportMarkdown()}>
          Export .md
        </button>
        {agentId ? (
          <button type="button" disabled={busy} onClick={() => void askAgent()}>
            Ask agent
          </button>
        ) : null}
      </form>
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
      <p className="mode-badge">{session.mode} · open two tabs and ack the same decision</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <DealBoard roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
