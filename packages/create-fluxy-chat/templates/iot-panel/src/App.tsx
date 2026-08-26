import { useState } from "react";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

function IotPanel({
  roomId,
  token,
  workerBase,
}: {
  roomId: string;
  token: string;
  workerBase: string;
}) {
  const [readings, setReadings] = useState<string[]>([]);
  const { connected, sendMessage, messages } = useChat({
    roomId,
    replay: "request",
    onServerEvent: (ev) => {
      if (ev.name === "iot.reading") {
        const d = ev.data;
        setReadings((prev) => [
          `${String(d.deviceId ?? ev.userId)} ${String(d.sensor ?? "value")}=${String(d.value)}`,
          ...prev,
        ].slice(0, 40));
      }
    },
  });

  const curl = `curl -X POST "$VITE_FLUXYCHAT_WORKER_URL/rooms/${roomId}/iot/events" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId":"sim-1","eventType":"telemetry","payload":{"temp":21}}'`;

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>IoT panel · {roomId}</strong>
        <span className="status">{connected ? "listening for iot.reading" : "connecting"}</span>
      </header>
      <p className="hint">{curl}</p>
      <p className="mode-badge" style={{ padding: "0 1rem" }}>
        HTTP ingest + device shadow. Not MQTT. Prefer POST /iot/devices/:id/readings after registerDevice.
      </p>
      <ul className="readings">
        {readings.length === 0 && messages.length === 0 ? <li>No events yet.</li> : null}
        {readings.map((row, i) => (
          <li key={`r-${i}`}>{row}</li>
        ))}
        {messages.slice(-12).map((msg) => (
          <li key={msg.id}>
            chat · {msg.userId}: {msg.content}
          </li>
        ))}
      </ul>
      <div className="composer">
        <button
          type="button"
          className="primary"
          onClick={() => {
            void fetch(new URL(`/rooms/${encodeURIComponent(roomId)}/iot/events`, workerBase).toString(), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                deviceId: "sim-1",
                eventType: "telemetry",
                payload: { temp: 20 + Math.round(Math.random() * 8) },
              }),
            });
            void sendMessage("simulated ingest posted");
          }}
        >
          Post sample ingest
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
      <p className="mode-badge">{session.mode} · keep this tab open while you curl</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <IotPanel roomId={session.roomId} token={session.token} workerBase={session.workerUrl} />
      </FluxyRealtimeProvider>
    </div>
  );
}
