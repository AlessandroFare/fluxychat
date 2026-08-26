import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import {
  FLUXY_YJS_EDITOR_FRAGMENT,
  FluxyYjsProvider,
  isLiveFile,
  uploadLiveFile,
  useMutation,
  useRedo,
  useStorage,
  useUndo,
  useYjsContext,
  type FluxyLiveFile,
} from "@fluxy-chat/sdk/yjs";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

interface FluxySession {
  workerUrl: string;
  token: string;
  userId: string;
  roomId: string;
  mode: "member" | "guest";
}

function useFluxySession(): {
  session: FluxySession | null;
  loading: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<FluxySession | null>(null);
  const [loading, setLoading] = useState(Boolean(workerUrl));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerUrl) {
      setLoading(false);
      return;
    }

    if (memberJwt) {
      setSession({
        workerUrl,
        token: memberJwt,
        userId: "demo-user",
        roomId: configuredRoomId,
        mode: "member",
      });
      setLoading(false);
      return;
    }

    if (publicRoomId) {
      let cancelled = false;
      void FluxyChatClient.joinPublicRoomAsGuest(workerUrl, publicRoomId, {
        displayName: "Guest",
      })
        .then((guest) => {
          if (cancelled) return;
          setSession({
            workerUrl,
            token: guest.token,
            userId: guest.userId,
            roomId: guest.roomId,
            mode: "guest",
          });
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Guest session failed");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setLoading(false);
  }, []);

  return { session, loading, error };
}

function DocBoard() {
  const { doc, connected, client, roomId } = useYjsContext();
  const title = useStorage((root) => (typeof root.title === "string" ? root.title : "Untitled"));
  const hero = useStorage((root) => (isLiveFile(root.hero) ? (root.hero as FluxyLiveFile) : null));
  const setTitle = useMutation((storage, next: string) => {
    storage.set("title", next);
  }, []);
  const setHero = useMutation((storage, file: FluxyLiveFile) => {
    storage.set("hero", file);
  }, []);
  const undo = useUndo();
  const redo = useRedo();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({
        document: doc,
        field: FLUXY_YJS_EDITOR_FRAGMENT,
      }),
    ],
  });

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const live = await uploadLiveFile(client, roomId, file);
    setHero(live);
  }

  return (
    <>
      <div className="chat-header">
        <strong>Tiptap room</strong>
        <span className="status">{connected ? "Yjs connected" : "connecting…"}</span>
      </div>
      <div className="toolbar">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Document title"
        />
        <button type="button" onClick={() => undo()}>
          Undo
        </button>
        <button type="button" onClick={() => redo()}>
          Redo
        </button>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => void onPickFile(event.target.files?.[0])}
        />
      </div>
      <div className="editor">
        {editor ? <EditorContent editor={editor} /> : <p>Loading editor…</p>}
        {hero ? <img className="hero" src={hero.url} alt={hero.name} /> : null}
      </div>
    </>
  );
}

export function App() {
  const { session, loading, error } = useFluxySession();
  const [roomOverride, setRoomOverride] = useState("");

  if (!workerUrl) {
    return (
      <div className="shell">
        <p>Set <code>VITE_FLUXYCHAT_WORKER_URL</code> in <code>.env</code>.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="shell">
        <p>Starting session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shell">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        <p>Set a member JWT or a public room id in <code>.env</code>.</p>
      </div>
    );
  }

  const roomId = roomOverride.trim() || session.roomId;

  return (
    <div className="shell">
      <p className="mode-badge">
        {session.mode} · room <code>{roomId}</code> · open two tabs
      </p>
      <label className="room-picker">
        Room id
        <input
          value={roomOverride}
          placeholder={session.roomId}
          onChange={(event) => setRoomOverride(event.target.value)}
        />
      </label>
      <FluxyYjsProvider
        key={roomId}
        workerUrl={session.workerUrl}
        token={session.token}
        userId={session.userId}
        roomId={roomId}
      >
        <DocBoard />
      </FluxyYjsProvider>
    </div>
  );
}
