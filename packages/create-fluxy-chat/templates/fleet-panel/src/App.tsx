import { useState } from "react";
import { FluxyRealtimeProvider, useChat, useFluxyChat } from "@fluxy-chat/react";
import { useFluxySession, workerUrl } from "./session";

function FleetBoard({ roomId }: { roomId: string }) {
  const { client } = useFluxyChat();
  const [rows, setRows] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const { connected } = useChat({
    roomId,
    replay: "request",
    onServerEvent: (ev) => {
      if (ev.name !== "fleet.gps_update") return;
      const d = ev.data;
      setRows((prev) =>
        [`${String(d.vehicleId)} ${String(d.lat)},${String(d.lng)}`, ...prev].slice(0, 40),
      );
    },
  });

  async function ensureVehicle() {
    if (!client) return null;
    if (vehicleId) return vehicleId;
    const created = await client.createFleetVehicle({ name: "demo-van" });
    setVehicleId(created.vehicle.id);
    return created.vehicle.id;
  }

  async function pingGps() {
    if (!client) return;
    const id = await ensureVehicle();
    if (!id) return;
    await client.ingestGps({
      vehicleId: id,
      lat: 45.46 + Math.random() * 0.01,
      lng: 9.18 + Math.random() * 0.01,
      roomId,
    });
  }

  const curl = `curl -X POST "$VITE_FLUXYCHAT_WORKER_URL/fleet/gps" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"vehicleId":"<id>","lat":45.46,"lng":9.18,"roomId":"${roomId}"}'`;

  return (
    <section className="panel">
      <header className="chat-header">
        <strong>Fleet · {roomId}</strong>
        <span className="status">{connected ? "listening for fleet.gps_update" : "connecting"}</span>
      </header>
      <p className="hint">{curl}</p>
      <ul className="readings">
        {rows.length === 0 ? <li>No GPS yet.</li> : null}
        {rows.map((row, i) => (
          <li key={`${row}-${i}`}>{row}</li>
        ))}
      </ul>
      <div className="composer">
        <button type="button" className="primary" onClick={() => void pingGps()}>
          Post sample GPS
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
      <p className="mode-badge">{session.mode} · HTTP GPS ingest. Not MQTT.</p>
      <FluxyRealtimeProvider workerUrl={session.workerUrl} authTokenProvider={session.token} userId={session.userId}>
        <FleetBoard roomId={session.roomId} />
      </FluxyRealtimeProvider>
    </div>
  );
}
