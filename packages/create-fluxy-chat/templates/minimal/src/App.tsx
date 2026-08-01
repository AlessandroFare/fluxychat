import { FluxyChatWidget } from "@fluxy-chat/ui-kit";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL;
const token = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT;
const roomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID || "general";

export function App() {
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>FluxyChat</h1>
      <FluxyChatWidget
        roomId={roomId}
        workerUrl={workerUrl}
        token={token}
        theme="default"
        height={520}
      />
      <p style={{ marginTop: "1rem", fontSize: 13, color: "#71717a" }}>
        Need stream, IoT, or agents? See{" "}
        <a href="https://docs.fluxychat.com/docs">full platform docs</a>.
      </p>
    </main>
  );
}
