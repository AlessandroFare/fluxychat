import { useRef, useState, type PointerEvent } from "react";
import * as Y from "yjs";
import { FluxyRealtimeProvider, useChat, useThreads } from "@fluxy-chat/react";
import { FluxyYjsProvider, useMutation, useStorage } from "@fluxy-chat/sdk/yjs";
import { CommentPin, CommentsList, FloatingComposer, Thread, type CommentThreadFilter } from "@fluxy-chat/ui";
import { useFluxySession, workerUrl } from "./session";

interface Stroke {
  id: string;
  color: string;
  points: number[];
}

function Board({ roomId, selfUserId }: { roomId: string; selfUserId: string }) {
  const strokes = useStorage((root) => (Array.isArray(root.strokes) ? (root.strokes as Stroke[]) : []));
  const addStroke = useMutation((storage, stroke: Stroke) => {
    let arr = storage.get("strokes");
    if (!(arr instanceof Y.Array)) {
      arr = new Y.Array();
      storage.set("strokes", arr);
    }
    (arr as Y.Array<Stroke>).push([stroke]);
  }, []);
  const {
    threads,
    createThread,
    createComment,
    markThreadAsResolved,
    deleteThread,
    deleteComment,
    editComment,
    addReaction,
    reload,
  } = useThreads({ roomId });
  const { liveCursors, sendCursor, connected } = useChat({
    roomId,
    replay: "off",
    onServerEvent: (ev) => {
      if (ev.name.startsWith("comment.")) void reload();
    },
  });
  const current = useRef<number[]>([]);
  const [preview, setPreview] = useState<number[]>([]);
  const [tool, setTool] = useState<"draw" | "comment">("draw");
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinsHidden, setPinsHidden] = useState(false);
  const [threadFilter, setThreadFilter] = useState<CommentThreadFilter>("open");

  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as const;
  }

  const openThread = threads.find((t) => t.id === openId) ?? null;

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Whiteboard · {roomId}</strong>
        <span className="status">{connected ? "Yjs + cursors + pins" : "connecting"}</span>
        <span className="tools">
          <button type="button" className={tool === "draw" ? "primary" : ""} onClick={() => setTool("draw")}>
            Draw
          </button>
          <button type="button" className={tool === "comment" ? "primary" : ""} onClick={() => setTool("comment")}>
            Comment
          </button>
          <button type="button" onClick={() => setPinsHidden((v) => !v)}>
            {pinsHidden ? "Show pins" : "Hide pins"}
          </button>
          <button type="button" onClick={() => setThreadFilter((v) => (v === "open" ? "all" : "open"))}>
            {threadFilter === "open" ? "Open only" : "All threads"}
          </button>
        </span>
      </header>
      <div
        className="canvas"
        onPointerDown={(event) => {
          if (tool !== "draw") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const [x, y] = point(event);
          current.current = [x, y];
          setPreview([x, y]);
        }}
        onPointerMove={(event) => {
          const [x, y] = point(event);
          sendCursor({ x, y, color: "#2563eb", label: selfUserId.slice(0, 12) });
          if (tool !== "draw" || event.buttons === 0) return;
          current.current = [...current.current, x, y];
          setPreview([...current.current]);
        }}
        onPointerUp={() => {
          if (tool !== "draw") return;
          const points = current.current;
          current.current = [];
          setPreview([]);
          if (points.length < 4) return;
          addStroke({ id: crypto.randomUUID(), color: "#0f172a", points });
        }}
        onClick={(event) => {
          if (tool !== "comment") return;
          const rect = event.currentTarget.getBoundingClientRect();
          setDraftPin({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
      >
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {strokes.map((stroke) => (
            <polyline
              key={stroke.id}
              points={chunkPoints(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {preview.length >= 4 ? (
            <polyline
              points={chunkPoints(preview)}
              fill="none"
              stroke="#0f172a"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
        {!pinsHidden &&
          threads.map((thread) =>
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
        {Object.values(liveCursors)
          .filter((c) => c.userId !== selfUserId)
          .map((cursor) => (
            <div
              key={cursor.userId}
              className="peer-cursor"
              style={{ left: cursor.x, top: cursor.y, color: cursor.color || "#2563eb" }}
            >
              <span>{cursor.label || cursor.userId}</span>
            </div>
          ))}
      </div>
      <aside style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
        <CommentsList threads={threads} openId={openId} filter={threadFilter} onSelect={setOpenId} />
        {openThread ? (
          <div style={{ marginTop: 12 }}>
            <Thread
              thread={openThread}
              onReply={(body) => createComment(openThread.id, body)}
              onResolve={(resolved) => markThreadAsResolved(openThread.id, resolved)}
              onDelete={async () => {
                await deleteThread(openThread.id);
                setOpenId(null);
              }}
              onEditComment={(commentId, body) => editComment(openThread.id, commentId, body)}
              onDeleteComment={(commentId) => deleteComment(openThread.id, commentId)}
              onReact={(commentId, emoji) => addReaction(openThread.id, commentId, emoji)}
            />
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function chunkPoints(points: number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push(`${points[i]},${points[i + 1]}`);
  return out.join(" ");
}

export function App() {
  const { session, loading, error } = useFluxySession();
  if (!workerUrl) return <div className="shell">Set <code>VITE_FLUXYCHAT_WORKER_URL</code>.</div>;
  if (loading) return <div className="shell">Starting…</div>;
  if (error) return <div className="shell error">{error}</div>;
  if (!session) return <div className="shell">Set a member JWT or public room id.</div>;

  return (
    <div className="shell">
      <p className="mode-badge">{session.mode} · Draw or Comment — Yjs + pins, not a tldraw SKU</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <FluxyYjsProvider
          workerUrl={session.workerUrl}
          token={session.token}
          userId={session.userId}
          roomId={session.roomId}
          awareness={{ userId: session.userId }}
        >
          <Board roomId={session.roomId} selfUserId={session.userId} />
        </FluxyYjsProvider>
      </FluxyRealtimeProvider>
    </div>
  );
}
