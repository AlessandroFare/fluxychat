import { useState } from "react";
import { FluxyRealtimeProvider, useChat, useThreads } from "@fluxy-chat/react";
import { CommentPin, FloatingComposer, Thread } from "@fluxy-chat/ui";
import { useFluxySession, workerUrl } from "./session";

function CommentsBoard({ roomId }: { roomId: string }) {
  const { threads, createThread, createComment, markThreadAsResolved, reload } = useThreads({ roomId });
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useChat({
    roomId,
    replay: "off",
    onServerEvent: (ev) => {
      if (ev.name.startsWith("comment.")) void reload();
    },
  });

  const openThread = threads.find((t) => t.id === openId) ?? null;

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Comments · {roomId}</strong>
        <span className="status">pins + threads, not chat replies</span>
      </header>
      <div
        className="canvas"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setDraftPin({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
      >
        {threads.map((thread) =>
          thread.metadata.x != null && thread.metadata.y != null ? (
            <CommentPin
              key={thread.id}
              x={thread.metadata.x}
              y={thread.metadata.y}
              count={thread.comments.length}
              resolved={thread.resolved}
              onClick={() => setOpenId(thread.id)}
            />
          ) : null,
        )}
        {draftPin ? (
          <FloatingComposer
            x={draftPin.x}
            y={draftPin.y}
            onCancel={() => setDraftPin(null)}
            onSubmit={async (body) => {
              const created = await createThread({ body, metadata: { x: draftPin.x, y: draftPin.y } });
              setDraftPin(null);
              if (created) setOpenId(created.id);
            }}
          />
        ) : null}
      </div>
      {openThread ? (
        <div style={{ padding: 12 }}>
          <Thread
            thread={openThread}
            onReply={(body) => createComment(openThread.id, body)}
            onResolve={(resolved) => markThreadAsResolved(openThread.id, resolved)}
          />
        </div>
      ) : null}
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
      <p className="mode-badge">{session.mode} · click the canvas to pin a thread</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <CommentsBoard roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
