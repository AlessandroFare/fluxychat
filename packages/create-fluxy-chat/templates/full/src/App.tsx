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

function consoleOrigin(): string {
  return consoleUrl.replace(/\/$/, "");
}

function clerkAuthHref(): string {
  const returnTo = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  return `${consoleOrigin()}/cli-auth?redirect_uri=${encodeURIComponent(returnTo)}`;
}

function dashboardHref(): string {
  return `${consoleOrigin()}/dashboard`;
}

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

function Brand() {
  return (
    <div className="brand">
      <img src={`${consoleOrigin()}/fluxychat-icon.svg`} alt="" width={28} height={28} />
      <span>FluxyChat</span>
    </div>
  );
}

const TOUR_STEPS = [
  {
    title: "You already have an app",
    body: "This folder is a real Vite chat app. After a short sign-in we create your project and a private room. No public playground.",
  },
  {
    title: "Realtime is the point",
    body: "After you are in, open this same URL in a second tab. Send a message in one window and watch it land in the other.",
  },
  {
    title: "Then the console",
    body: "Sign in is required: that is what creates (or reuses) your project and assistant room. After that the two-tab demo works. The dashboard is a separate button once you are in chat.",
  },
] as const;

function LocalOnboarding() {
  const [step, setStep] = useState(0);
  const last = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];

  return (
    <main className="app-shell">
      <header className="topbar">
        <Brand />
        <span className="meta">
          {step + 1} / {TOUR_STEPS.length}
        </span>
      </header>
      <div className="onboard">
        <div className="dots" aria-hidden>
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={`dot-step ${i === step ? "active" : ""}`} />
          ))}
        </div>
        <p className="eyebrow">Quick start</p>
        <h1>{current.title}</h1>
        <p>{current.body}</p>
        <div className="onboard-actions">
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          {last ? (
            <a className="btn-primary" href={clerkAuthHref()}>
              Sign in or create account
            </a>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          )}
        </div>
        {last ? (
          <p className="fine-print">
            Clerk on fluxychat.com, then back here with your room ready.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function ChatRoom({ session }: { session: CliSession }) {
  const {
    messages,
    sendMessage,
    invokeAgent,
    connectionState,
    agentTyping,
    typingUsers,
    online,
    stopAgentStream,
  } = useChat({
    roomId: session.roomId,
    agentId: session.agentId || undefined,
    markReadLatest: true,
  });

  const [error, setError] = useState<string | null>(null);
  const connected = connectionState.status === "connected";
  const isStreaming = messages.some((m) => m.streaming);

  async function onSend(content: string) {
    setError(null);
    const mentionsAgent = content
      .toLowerCase()
      .includes((session.agentHandle || "@assistant").replace(/^@/, "").toLowerCase());
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
          <span className="text-muted-foreground"> · {session.roomId}</span>
        </span>
        {isStreaming ? (
          <button type="button" className="btn-ghost" onClick={() => stopAgentStream()}>
            Stop generation
          </button>
        ) : null}
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

  if (!session) return <LocalOnboarding />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="top-links">
          <span className="meta">{session.projectName || session.projectId || "your room"}</span>
          <a href={dashboardHref()} target="_blank" rel="noreferrer">
            Open dashboard
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
            <h2>Try this</h2>
            <ul>
              <li>Open a second tab on this same URL</li>
              <li>Send a message in one tab. It should appear in the other.</li>
              <li>Mention the agent to get a reply</li>
            </ul>
          </section>
          <section>
            <h2>Project</h2>
            <dl>
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
            <h2>Console</h2>
            <p className="side-copy">Rooms, agents, and settings live in the dashboard.</p>
            <a className="btn-primary side-btn" href={dashboardHref()} target="_blank" rel="noreferrer">
              Open dashboard
            </a>
          </section>
        </aside>
      </div>
    </main>
  );
}
