import { FluxyChatWidget } from "@fluxy-chat/ui-kit";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL;
const publishableKey = import.meta.env.VITE_FLUXYCHAT_PUBLISHABLE_KEY;
const roomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID || "general";
const agentId = import.meta.env.VITE_FLUXYCHAT_AGENT_ID?.trim();

export function App() {
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Shared AI room</h1>
      <p style={{ fontSize: 14, color: "#52525b", marginBottom: "1rem" }}>
        Guest join with pk_. No console signup. Open a second tab for another human.
      </p>
      <FluxyChatWidget
        roomId={roomId}
        workerUrl={workerUrl}
        guest
        publishableKey={publishableKey}
        agentId={agentId}
        theme="default"
        height={560}
        title={roomId}
      />
    </main>
  );
}
