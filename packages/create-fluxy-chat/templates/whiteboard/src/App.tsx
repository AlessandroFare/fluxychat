import { useRef, useState, type PointerEvent } from "react";
import * as Y from "yjs";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { FluxyYjsProvider, useMutation, useStorage } from "@fluxy-chat/sdk/yjs";
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
  const { liveCursors, sendCursor, connected } = useChat({ roomId, replay: "off" });
  const current = useRef<number[]>([]);
  const [preview, setPreview] = useState<number[]>([]);

  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as const;
  }

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Whiteboard · {roomId}</strong>
        <span className="status">{connected ? "Yjs + cursors" : "connecting"}</span>
      </header>
      <div
        className="canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const [x, y] = point(event);
          current.current = [x, y];
          setPreview([x, y]);
        }}
        onPointerMove={(event) => {
          const [x, y] = point(event);
          sendCursor({ x, y, color: "#2563eb", label: selfUserId.slice(0, 12) });
          if (event.buttons === 0) return;
          current.current = [...current.current, x, y];
          setPreview([...current.current]);
        }}
        onPointerUp={() => {
          const points = current.current;
          current.current = [];
          setPreview([]);
          if (points.length < 4) return;
          addStroke({ id: crypto.randomUUID(), color: "#0f172a", points });
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
      <p className="mode-badge">{session.mode} · draw in two tabs — Yjs strokes, not Excalidraw lock-in</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <FluxyYjsProvider workerUrl={session.workerUrl} token={session.token} userId={session.userId} roomId={session.roomId}>
          <Board roomId={session.roomId} selfUserId={session.userId} />
        </FluxyYjsProvider>
      </FluxyRealtimeProvider>
    </div>
  );
}
