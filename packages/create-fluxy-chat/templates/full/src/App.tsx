import { useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const roomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "general";
const agentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim() || "";
const agentHandle = import.meta.env.VITE_FLUXYCHAT_AGENT_HANDLE?.trim() || "@assistant";
const projectId = import.meta.env.VITE_FLUXYCHAT_PROJECT_ID?.trim() || "";
const consoleUrl = import.meta.env.VITE_FLUXYCHAT_CONSOLE_URL?.trim() || "http://localhost:3000";
const memberUserId =
  import.meta.env.VITE_FLUXYCHAT_USER_ID?.trim() || "demo-user";

function ChatRoom() {
  const {
    messages,
    sendMessage,
    invokeAgent,
    connectionState,
    agentTyping,
    toolThreadEvents,
    lastAgentRun,
  } = useChat({
    roomId,
    agentId: agentId || undefined,
    markReadLatest: true,
  });

  const [draft, setDraft] = useState("");
  const [invokeError, setInvokeError] = useState<string | null>(null);

  async function handleSendMessage(text: string) {
    setInvokeError(null);
    await sendMessage(text);
  }

  async function handleInvokeAgent(text: string) {
    if (!agentId) {
      setInvokeError("Set VITE_FLUXYCHAT_AGENT_ID in .env (run pnpm setup).");
      return;
    }
    setInvokeError(null);
    try {
      await invokeAgent(text, { agentId });
    } catch (err) {
      setInvokeError(err instanceof Error ? err.message : "Agent invoke failed");
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <strong>{roomId}</strong>
        <span className="status">{connectionState.status}</span>
      </header>

      <ul className="messages">
        {messages.map((m) => {
          const isSelf = m.userId === memberUserId || m.userId === "first-message-user";
          const isAgent = m.userId?.includes("agent") || m.userId === "assistant";
          return (
            <li
              key={m.id ?? `${m.createdAt}-${m.userId}`}
              className={`message${isSelf ? " self" : ""}${isAgent ? " agent" : ""}`}
            >
              <span className="author">{m.userId}</span>
              <span>{m.content}</span>
            </li>
          );
        })}
      </ul>

      {agentTyping ? <p className="typing">{agentHandle} is thinking…</p> : null}

      {(toolThreadEvents.length > 0 || lastAgentRun?.toolCalls?.length) ? (
        <div className="tools">
          <h3>Agent tools</h3>
          <ul>
            {toolThreadEvents.map((ev) => (
              <li key={ev.key}>
                {String(ev.kind ?? "tool")}: {String(ev.title ?? ev.toolName ?? ev.key)}
              </li>
            ))}
            {(lastAgentRun?.toolCalls ?? []).map((tc) => (
              <li key={tc.id}>
                {tc.name}: {tc.status ?? "done"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {invokeError ? <p className="hint" style={{ color: "#b91c1c", padding: "0 1rem" }}>{invokeError}</p> : null}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          void handleSendMessage(text);
          setDraft("");
        }}
      >
        <div className="composer-row">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message or ask @assistant…"
            aria-label="Message"
          />
          <button type="submit">Send</button>
          <button
            type="button"
            className="secondary"
            disabled={!draft.trim()}
            onClick={() => {
              const text = draft.trim();
              if (!text) return;
              const payload = text.startsWith("@") ? text : `${agentHandle} ${text}`;
              void handleInvokeAgent(payload);
              setDraft("");
            }}
          >
            Ask agent
          </button>
        </div>
        <p className="hint">
          Realtime via WebSocket · Agent replies stream in-room · Tool calls appear above
        </p>
      </form>
    </section>
  );
}

export function App() {
  const client = useMemo(() => {
    if (!workerUrl || !memberJwt) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: memberUserId,
      token: memberJwt,
    });
  }, []);

  if (!workerUrl || !memberJwt) {
    return (
      <main className="shell">
        <div className="error-box">
          <p>
            <strong>Setup required.</strong> Run provisioning against a local FluxyChat worker:
          </p>
          <pre>
            <code>{`# Terminal 1 — from FluxyChat monorepo
pnpm --filter @fluxy-chat/worker dev

# Terminal 2 — in this project
pnpm setup
pnpm dev`}</code>
          </pre>
          <p>
            Or copy <code>.env.example</code> → <code>.env</code> with credentials from{" "}
            <a href="https://fluxychat.com/onboarding" target="_blank" rel="noreferrer">
              fluxychat.com/onboarding
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  if (!client) return null;

  return (
    <main className="shell">
      <div className="hero">
        <h1>FluxyChat — full stack starter</h1>
        <p>
          Your app · Worker {workerUrl} ·{" "}
          <a href={`${consoleUrl.replace(/\/$/, "")}/onboarding?from=cli`} target="_blank" rel="noreferrer">
            Keep this project
          </a>
        </p>
      </div>

      <div className="layout">
        <FluxyRealtimeProvider client={client}>
          <ChatRoom />
        </FluxyRealtimeProvider>

        <aside className="side">
          <div className="card">
            <h2>Project</h2>
            <dl>
              <div>
                <dt>Project ID</dt>
                <dd>{projectId || "—"}</dd>
              </div>
              <div>
                <dt>Room</dt>
                <dd>{roomId}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{agentHandle}{agentId ? ` (${agentId.slice(0, 12)}…)` : ""}</dd>
              </div>
            </dl>
          </div>
          <div className="card">
            <h2>Try next</h2>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>Open a second tab — same URL — for realtime</li>
              <li>Ask the agent about FluxyChat architecture</li>
              <li>Manage rooms & agents in the console</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
