"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy, Check, Zap } from "lucide-react";
import { Button, Section } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

interface RoomExternalEventPanelProps {
  roomId: string;
  memberJwt: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void copy()}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function RoomExternalEventPanel({ roomId, memberJwt }: RoomExternalEventPanelProps) {
  const workerUrl = getPublicWorkerUrl().replace(/\/$/, "");
  const [eventName, setEventName] = useState("external.incident");
  const [payload, setPayload] = useState('{"source":"usgs","magnitude":4.2}');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const curl = useMemo(
    () =>
      [
        `curl -sS -X POST "${workerUrl}/events" \\`,
        `  -H "Authorization: Bearer ${memberJwt || "<member-jwt>"}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"roomIds":["${roomId}"],"name":"external.incident","data":{"source":"usgs","magnitude":4.2}}'`,
      ].join("\n"),
    [workerUrl, memberJwt, roomId],
  );

  async function simulate() {
    if (!memberJwt.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        setStatus("Invalid JSON payload");
        return;
      }
      const res = await fetchWorkerJson<{ ok?: boolean; triggered?: string[] }>(
        `${workerUrl}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${memberJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomIds: [roomId], name: eventName.trim(), data }),
        },
      );
      setStatus(res.triggered?.length ? `Triggered in ${res.triggered.join(", ")}` : "Event sent");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="External event ingest"
      description="Land a webhook-style signal on the room timeline (PH-111). Ambient agents can react to external.incident."
    >
      <div className="grid gap-2">
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Event name"
        />
        <textarea
          className="min-h-[72px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void simulate()}>
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          {busy ? "Sending…" : "Simulate event"}
        </Button>
        <CopyButton text={curl} label="Copy curl" />
      </div>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </Section>
  );
}
