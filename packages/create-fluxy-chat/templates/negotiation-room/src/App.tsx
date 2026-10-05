import { useEffect, useMemo, useState } from "react";
import { FluxyRealtimeProvider, useChat, useFeedMessages, useFeeds, useFluxyChat } from "@fluxy-chat/react";
import { readDealSeat, useFluxySession, workerUrl, type DealSeat } from "./session";

const TRACE_FEED_NAME = "Agent traces";

function otherSeatHref(seat: DealSeat): string {
  const url = new URL(window.location.href);
  url.searchParams.set("seat", seat === "buyer" ? "counsel" : "buyer");
  return url.toString();
}

function DealBoard({ roomId, seat, selfUserId, mode }: { roomId: string; seat: DealSeat; selfUserId: string; mode: "member" | "guest" }) {
  const { client } = useFluxyChat();
  const {
    messages,
    sendMessage,
    connected,
    invokeAgent,
    stopAgentStream,
    agentTyping,
    presenceMembers,
    livePresence,
    sendPresencePatch,
  } = useChat({ roomId, replay: "request" });
  const { feeds, createFeed } = useFeeds({ roomId });
  const traceFeed = useMemo(
    () => feeds.find((f) => f.name === TRACE_FEED_NAME || f.kind === "agent") ?? null,
    [feeds],
  );
  const { messages: traces, createMessage: createTrace } = useFeedMessages({
    roomId,
    feedId: traceFeed?.id ?? null,
  });
  const [draft, setDraft] = useState("Ask: mutual indemnity — redline or accept?");
  const [busy, setBusy] = useState(false);
  const [feedHint, setFeedHint] = useState<string | null>(null);
  const agentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim();
  const sameIdentity = mode === "member";
  const streaming = messages.some((m) => m.streaming) || agentTyping;

  useEffect(() => {
    sendPresencePatch({ agentStatus: seat });
  }, [seat, sendPresencePatch]);

  useEffect(() => {
    if (!client || traceFeed) return;
    let cancelled = false;
    void createFeed({ name: TRACE_FEED_NAME, kind: "agent" })
      .then((feed) => {
        if (!cancelled && !feed) setFeedHint("Feeds need a member JWT. Guest tabs still get chat, quorum, and whispers.");
      })
      .catch(() => {
        if (!cancelled) setFeedHint("Feeds need a member JWT. Guest tabs still get chat, quorum, and whispers.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, createFeed, traceFeed]);

  async function logTrace(body: string, status: string) {
    if (!createTrace) return;
    try {
      await createTrace({ body, metadata: { source: "negotiation-room", status } });
    } catch {
      /* guest / no feed */
    }
  }

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
    sendPresencePatch({ agentStatus: "asking" });
    await logTrace("invoke started", "running");
    try {
      await invokeAgent(
        "List open clauses as auto, ask, or deny. Not legal advice. Do not invent a closing date.",
        { agentId },
      );
      await logTrace("invoke finished", "ok");
    } catch (err) {
      console.error(err);
      await logTrace("invoke failed", "error");
      await sendMessage("[agent unavailable] List open clauses as auto / ask / deny.");
    } finally {
      sendPresencePatch({ agentStatus: seat });
      setBusy(false);
    }
  }

  async function mentionAssistant() {
    setBusy(true);
    try {
      sendMessage("@assistant list open clauses auto ask deny");
    } finally {
      setBusy(false);
    }
  }

  // Whisper is visibleTo this tab's userId. The buyer tab has another guest id, so the Worker never delivers it there.
  async function whisperToSelfAsCounsel() {
    setBusy(true);
    try {
      sendMessage("Counsel only: redlines on section 4.", null, undefined, {
        visibility: "whisper",
        visibleTo: [selfUserId],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deal-layout">
      <section className="panel">
        <header className="chat-header">
          <strong>
            Negotiation room · {roomId} · {seat}
          </strong>
          <span className="status" data-testid="deal-status">
            {connected ? "live" : "connecting"}
            {streaming ? " · agent streaming" : ""}
          </span>
        </header>
        <p className="hint" style={{ margin: "0.75rem" }}>
          Open two tabs: this URL, then{" "}
          <a href={otherSeatHref(seat)}>
            {seat === "buyer" ? "counsel" : "buyer"}
          </a>
          . Clause policy is auto / ask / deny. Ask uses HITL in this room. Not Harvey. Quorum acks from both. Counsel whisper is filtered on the Worker, not hidden in CSS.
          {sameIdentity
            ? " Member JWT is the same user in both tabs, so whisper will show in both. Use a public guest room for the visibility check."
            : null}
        </p>
        <ul className="roster">
          {presenceMembers.map((m) => (
            <li key={m.userId}>
              {m.userId}
              {m.userId === selfUserId ? " (you)" : ""}
              {livePresence[m.userId]?.agentStatus ? ` · ${String(livePresence[m.userId]?.agentStatus)}` : ""}
            </li>
          ))}
        </ul>
        <div className="log" data-testid="deal-log">
          {messages.map((msg) => (
            <p key={msg.id} className={msg.visibility && msg.visibility !== "room" ? "whisper" : undefined} data-testid="deal-message">
              <strong>{msg.userId}:</strong> {msg.content}
              {msg.streaming ? " …" : null}
              {msg.visibility && msg.visibility !== "room" ? ` · ${msg.visibility}` : null}
              {msg.decision ? (
                <>
                  {" "}
                  · quorum {msg.decision.totalCurrent}/{msg.decision.totalRequired}
                  {msg.decision.quorumMet ? " met" : ""}
                  {msg.decision.state === "pending" ? (
                    <button
                      type="button"
                      className="primary"
                      style={{ marginLeft: 8 }}
                      disabled={busy}
                      data-testid="ack-decision"
                      onClick={() => void ack(msg.id)}
                    >
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
          <button type="submit" disabled={busy} data-testid="propose">
            Propose
          </button>
          <button type="button" className="primary" onClick={() => void exportMarkdown()}>
            Export .md
          </button>
          {agentId ? (
            <button type="button" disabled={busy} data-testid="ask-agent" onClick={() => void askAgent()}>
              Ask agent
            </button>
          ) : (
            <button type="button" disabled={busy} data-testid="ask-agent" onClick={() => void mentionAssistant()}>
              @assistant
            </button>
          )}
          {streaming ? (
            <button type="button" data-testid="stop-stream" onClick={() => stopAgentStream()}>
              Stop stream
            </button>
          ) : null}
          {seat === "counsel" ? (
            <button type="button" data-testid="counsel-note" disabled={busy || sameIdentity} onClick={() => void whisperToSelfAsCounsel()}>
              Counsel note
            </button>
          ) : null}
        </form>
      </section>
      <aside className="panel traces">
        <header className="chat-header">
          <strong>Agent traces</strong>
          <span className="status">feeds, not chat</span>
        </header>
        <p className="hint" style={{ margin: "0.75rem" }}>
          Token stream lands on the chat bubble. This column is the log. If the Durable Object hibernates mid-stream, we do not resume the LLM call the way Cloudflare Think does. Reconnect keeps messages already persisted.
        </p>
        {feedHint ? <p className="hint">{feedHint}</p> : null}
        <ul className="readings">
          {traces.map((row) => (
            <li key={row.id}>
              {row.body}
              {row.metadata?.status ? ` · ${row.metadata.status}` : ""}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export function App() {
  const seat = readDealSeat();
  const { session, loading, error } = useFluxySession(seat);
  if (!workerUrl) return <div className="shell">Set <code>VITE_FLUXYCHAT_WORKER_URL</code>.</div>;
  if (loading) return <div className="shell">Starting…</div>;
  if (error) return <div className="shell error">{error}</div>;
  if (!session) return <div className="shell">Set a member JWT or public room id.</div>;

  return (
    <div className="shell">
      <p className="mode-badge">
        {session.mode} · seat={seat} · you={session.userId}
      </p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <DealBoard roomId={session.roomId} seat={seat} selfUserId={session.userId} mode={session.mode} />
      </FluxyRealtimeProvider>
    </div>
  );
}
