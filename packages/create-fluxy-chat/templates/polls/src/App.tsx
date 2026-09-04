import { useState } from "react";
import {
  FluxyRealtimeProvider,
  useChat,
  useFluxyChat,
} from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

const publishableKey = import.meta.env.VITE_FLUXYCHAT_PUBLISHABLE_KEY?.trim();
const pkRoomId =
  import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() ||
  import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim() ||
  "demo";

function PollRoom({ roomId }: { roomId: string }) {
  const { client } = useFluxyChat();
  const { messages } = useChat({ roomId });
  const [question, setQuestion] = useState("Ship Friday?");
  const [error, setError] = useState<string | null>(null);

  async function createTimelinePoll() {
    setError(null);
    try {
      await client.createPoll(roomId, {
        question,
        options: ["Yes", "No", "Abstain"],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "createPoll failed");
    }
  }

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Polls · {roomId}</strong>
        <span className="status">createPoll / votePoll on the timeline</span>
      </header>
      <div className="composer">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Question"
        />
        <button type="button" className="primary" onClick={() => void createTimelinePoll()}>
          Create poll
        </button>
      </div>
      {error ? <p className="error" style={{ padding: "0 1rem" }}>{error}</p> : null}
      <ul className="log">
        {messages.map((message) => (
          <li key={message.id} className="poll-card">
            {message.poll ? (
              <>
                <p>
                  <strong>{message.poll.question}</strong>
                  {message.poll.closed ? " · closed" : ""}
                </p>
                <div className="poll-options">
                  {message.poll.options.map((option) => (
                    <button
                      key={option.index}
                      type="button"
                      disabled={message.poll?.closed}
                      onClick={() => void client.votePoll(message.id, option.index)}
                    >
                      {option.text} · {option.votes}
                    </button>
                  ))}
                </div>
                <p className="hint" style={{ marginTop: 8 }}>
                  {message.poll.totalVoters} voters
                  {message.poll.userVote != null ? ` · you voted ${message.poll.userVote}` : ""}
                </p>
              </>
            ) : (
              <p>
                <strong>{message.userId}</strong> {message.content}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function App() {
  if (!workerUrl) return <div className="shell">Set <code>VITE_FLUXYCHAT_WORKER_URL</code>.</div>;

  if (publishableKey) {
    return (
      <div className="shell">
        <p className="mode-badge">publishableKey · public room {pkRoomId}</p>
        <p className="hint">
          Timeline polls use createPoll. Anonymous ballots (no voter ids in results) are POST /polls with isAnonymous: true. See README.
        </p>
        <FluxyRealtimeProvider workerUrl={workerUrl} publishableKey={publishableKey}>
          <PollRoom roomId={pkRoomId} />
        </FluxyRealtimeProvider>
      </div>
    );
  }

  return <MemberOrGuestApp />;
}

function MemberOrGuestApp() {
  const { session, loading, error } = useFluxySession();
  if (loading) return <div className="shell">Starting…</div>;
  if (error) return <div className="shell error">{error}</div>;
  if (!session) {
    return (
      <div className="shell">
        Set <code>VITE_FLUXYCHAT_PUBLISHABLE_KEY</code>, a member JWT, or a public room id.
      </div>
    );
  }

  return (
    <div className="shell">
      <p className="mode-badge">{session.mode} · {session.roomId}</p>
      <p className="hint">
        Timeline polls use createPoll. Anonymous ballots: POST /polls with isAnonymous: true. See README.
      </p>
      <FluxyRealtimeProvider
        workerUrl={session.workerUrl}
        authTokenProvider={session.token}
        userId={session.userId}
      >
        <PollRoom roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
