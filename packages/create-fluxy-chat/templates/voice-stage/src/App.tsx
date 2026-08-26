import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

function StageBoard({ roomId }: { roomId: string }) {
  const { connected, voiceStage, joinVoiceStage, leaveVoiceStage, sendVoiceStageVad } = useChat({
    roomId,
    replay: "request",
  });

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Voice stage · {roomId}</strong>
        <span className="status">{connected ? "live" : "connecting"} · signaling only</span>
      </header>
      <p className="hint">
        stage_join / stage_leave on the same room WS. No huddle audio, no unpublished P95. Clips: POST /messages/voice.
      </p>
      <ul className="readings">
        {(voiceStage?.participants ?? []).length === 0 ? <li>Empty stage.</li> : null}
        {(voiceStage?.participants ?? []).map((p) => (
          <li key={p.userId}>
            {p.displayName || p.userId} · {p.role}
            {p.isActiveSpeaker ? " · speaking" : ""}
          </li>
        ))}
      </ul>
      <div className="composer">
        <button type="button" className="primary" onClick={() => joinVoiceStage("speaker", "Demo")}>
          Join as speaker
        </button>
        <button type="button" className="primary" onClick={() => joinVoiceStage("listener", "Demo")}>
          Join as listener
        </button>
        <button type="button" className="primary" onClick={() => sendVoiceStageVad(0.8)}>
          Pulse VAD
        </button>
        <button type="button" className="primary" onClick={() => leaveVoiceStage()}>
          Leave
        </button>
      </div>
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
      <p className="mode-badge">{session.mode} · presence stage, not WebRTC</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <StageBoard roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
