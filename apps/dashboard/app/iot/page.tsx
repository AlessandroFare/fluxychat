"use client";

import { useCallback, useState } from "react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section } from "../components/ui";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { Radio } from "lucide-react";

const BASE = getPublicWorkerUrl();

export default function IotPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [deviceId, setDeviceId] = useState("sensor-01");
  const [eventType, setEventType] = useState("temperature");
  const [value, setValue] = useState("22.5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  async function sendEvent() {
    if (!token || !roomId.trim() || !deviceId.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fetchWorkerJson<Record<string, unknown>>(
        `${BASE}/rooms/${encodeURIComponent(roomId.trim())}/iot/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId: deviceId.trim(),
            eventType: eventType.trim(),
            payload: { value: Number(value) || value },
          }),
        },
      );
      setLastResult(result);
      setNotice(`Event ingested. Message #${String(result.messageId ?? "?")}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "IoT ingest failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="IoT event bus"
        description="Device events become room messages and can trigger ambient agents."
        icon={Radio}
      />
      <ConsoleFeedback error={error} notice={notice} />

      <Section title="Send test event">
        <Panel className="max-w-xl space-y-3">
          <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
          <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Device ID" />
          <Input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Event type" />
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Payload value" />
          <Button size="sm" disabled={busy || !token} onClick={() => void sendEvent()}>
            {busy ? "Sending…" : "Post IoT event"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Configure ambient agent policies with <code className="rounded bg-muted px-1">message_keyword</code> or{" "}
            <code className="rounded bg-muted px-1">room_event</code> triggers on{" "}
            <a href="/agents/ambient" className="text-primary underline">Ambient agents</a>.
          </p>
        </Panel>
      </Section>

      {lastResult ? (
        <Section title="Last response">
          <Panel>
            <pre className="overflow-auto text-xs">{JSON.stringify(lastResult, null, 2)}</pre>
          </Panel>
        </Section>
      ) : null}
    </ConsoleShell>
  );
}
