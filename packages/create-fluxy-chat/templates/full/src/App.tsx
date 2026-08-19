import { useMemo, useState } from "react";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { ChatWindow } from "@fluxy-chat/ui";
import { loadCliSession, type CliSession } from "./session";

const envWorkerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim() ?? "";
const envJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim() ?? "";
const envRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() ?? "";
const envAgentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim() ?? "";
const envAgentHandle = import.meta.env.VITE_FLUXYCHAT_AGENT_HANDLE?.trim() || "@assistant";
const envProjectId = import.meta.env.VITE_FLUXYCHAT_PROJECT_ID?.trim() ?? "";
const envUserId = import.meta.env.VITE_FLUXYCHAT_USER_ID?.trim() ?? "";
const consoleUrl = import.meta.env.VITE_FLUXYCHAT_CONSOLE_URL?.trim() || "https://fluxychat.com";

const SUGGESTED_PROMPTS = [
  "Tell me about FluxyChat features",
  "What can this assistant do?",
];

function sessionFromEnv(): CliSession | null {
  if (!envWorkerUrl || !envJwt || !envRoomId) return null;
  return {
    workerUrl: envWorkerUrl,
    memberJwt: envJwt,
    roomId: envRoomId,
    agentId: envAgentId,
    agentHandle: envAgentHandle,
    projectId: envProjectId,
    userId: envUserId || "demo-user",
  };
}

function SignInGate() {
  const returnTo = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const href = `${consoleUrl.replace(/\/$/, "")}/cli-auth?redirect_uri=${encodeURIComponent(returnTo)}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src={`${consoleUrl.replace(/\/$/, "")}/fluxychat-icon.svg`} alt="" width={28} height={28} />
          <span>FluxyChat</span>
        </div>
      </header>
      <div className="signin-card">
        <p className="eyebrow">Local starter</p>
        <h1>Sign in to open your room</h1>
        <p>
          Use the same Clerk account as the console. We create your project and
          assistant room, then you chat here.
        </p>
        <a className="btn-primary" href={href}>
          Continue with FluxyChat
        </a>
        <p className="fine-print">
          Opens {consoleUrl.replace(/^https?:\/\//, "")} for sign in, then returns to this app.
        </p>
      </div>
    </main>
  );
}

function ChatRoom({ session }: { session: CliSession }) {
  const { messages, sendMessage, invokeAgent, connectionState, agentTyping, typingUsers, online } =
    useChat({
      roomId: session.roomId,
      agentId: session.agentId || undefined,
      markReadLatest: true,
    });

  const [error, setError] = useState<string | null>(null);
  const connected = connectionState.status === "connected";

  async function onSend(content: string) {
    setError(null);
    const mentionsAgent = content.toLowerCase().includes(
      (session.agentHandle || "@assistant").replace(/^@/, "").toLowerCase(),
    );
    try {
      if (mentionsAgent && session.agentId) {
        await invokeAgent(content, { agentId: session.agentId });
      } else {
        await sendMessage(content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  }

  return (
    <div className="chat-column">
      <div className="status-row">
        <span className="inline-flex items-center gap-2">
          <span className={`status-dot ${connected ? "on" : "off"}`} />
          <span className="font-medium text-foreground">
            {connected ? "Connected" : connectionState.status}
          </span>
          <span className="text-muted-foreground">· {session.roomId}</span>
        </span>
      </div>

      <div className="chat-frame">
        <ChatWindow
          messages={messages}
          online={online ?? 0}
          typingUsers={typingUsers ?? {}}
          onSend={(content) => {
            void onSend(content);
          }}
          agentTyping={Boolean(agentTyping)}
          agentTypingLabel={session.agentHandle || "@assistant"}
          mentionSuggestions={[
            {
              handle: (session.agentHandle || "@assistant").replace(/^@/, ""),
              label: session.agentHandle || "@assistant",
              agentId: session.agentId,
            },
          ]}
        />
      </div>

      <div className="prompts">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              const handle = session.agentHandle || "@assistant";
              void onSend(`${handle} ${prompt}`);
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
      {error ? <p className="chat-error">{error}</p> : null}
    </div>
  );
}

export function App() {
  const session = useMemo(() => loadCliSession() ?? sessionFromEnv(), []);

  if (!session) return <SignInGate />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src={`${consoleUrl.replace(/\/$/, "")}/fluxychat-icon.svg`} alt="" width={28} height={28} />
          <span>FluxyChat</span>
        </div>
        <nav className="top-links">
          <span className="meta">{session.projectName || session.projectId || "project"}</span>
          <a href={`${consoleUrl.replace(/\/$/, "")}/onboarding?from=cli`} target="_blank" rel="noreferrer">
            Open console
          </a>
        </nav>
      </header>
      <div className="page">
        <FluxyRealtimeProvider
          workerUrl={session.workerUrl}
          authTokenProvider={session.memberJwt}
          userId={session.userId}
        >
          <ChatRoom session={session} />
        </FluxyRealtimeProvider>
        <aside className="side">
          <section>
            <h2>Project</h2>
            <dl>
              <div>
                <dt>ID</dt>
                <dd>{session.projectId || "—"}</dd>
              </div>
              <div>
                <dt>Room</dt>
                <dd>{session.roomId}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{session.agentHandle}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2>Next</h2>
            <ul>
              <li>Send a message, or mention the agent to invoke it</li>
              <li>Open a second tab on this URL for realtime</li>
              <li>
                <a href={`${consoleUrl.replace(/\/$/, "")}/onboarding?from=cli`} target="_blank" rel="noreferrer">
                  Continue onboarding in the console
                </a>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
