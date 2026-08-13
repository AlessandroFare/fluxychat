"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Copy, Check, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button, Section } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomPresenceEscalationPanelProps {
  roomId: string;
  memberJwt: string;
}

interface PresenceEscalationWatch {
  id: string;
  status: string;
  awaitingUserId?: string | null;
  escalationChain: string[];
  currentTierIndex: number;
  nudgeIntervalSeconds: number;
  awaitingResponseSince?: string;
  lastNudgeAt?: string | null;
  lastNudgedUserId?: string | null;
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

export function RoomPresenceEscalationPanel({ roomId, memberJwt }: RoomPresenceEscalationPanelProps) {
  const workerUrl = getPublicWorkerUrl().replace(/\/$/, "");
  const [chainInput, setChainInput] = useState("tier1, tier2, manager");
  const [awaitingUserId, setAwaitingUserId] = useState("");
  const [nudgeIntervalSeconds, setNudgeIntervalSeconds] = useState("300");
  const [watch, setWatch] = useState<PresenceEscalationWatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${memberJwt}`,
      "Content-Type": "application/json",
    }),
    [memberJwt],
  );

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkerJson<{ watch: PresenceEscalationWatch | null }>(
        `${workerUrl}/rooms/${encodeURIComponent(roomId)}/presence-escalation`,
        { headers: { Authorization: `Bearer ${memberJwt}` } },
      );
      setWatch(data.watch ?? null);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load escalation status"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId, workerUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEscalation() {
    if (!memberJwt.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const escalationChain = chainInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const data = await fetchWorkerJson<{ watch: PresenceEscalationWatch }>(
        `${workerUrl}/rooms/${encodeURIComponent(roomId)}/presence-escalation`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            escalationChain,
            awaitingUserId: awaitingUserId.trim() || undefined,
            nudgeIntervalSeconds: Math.max(60, Number(nudgeIntervalSeconds) || 300),
          }),
        },
      );
      setWatch(data.watch);
      setNotice("Escalation chain started. Cron nudges the next online user every interval.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to start escalation"));
    } finally {
      setBusy(false);
    }
  }

  async function resolveEscalation() {
    if (!memberJwt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await fetchWorkerJson(
        `${workerUrl}/rooms/${encodeURIComponent(roomId)}/presence-escalation/resolve`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ reason: "manual_resolve" }),
        },
      );
      setWatch(null);
      setNotice("Escalation resolved.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to resolve escalation"));
    } finally {
      setBusy(false);
    }
  }

  const curl = [
    `curl -sS -X POST "${workerUrl}/rooms/${encodeURIComponent(roomId)}/presence-escalation" \\`,
    `  -H "Authorization: Bearer ${memberJwt || "<member-jwt>"}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"escalationChain":["tier1","tier2","manager"],"nudgeIntervalSeconds":300}'`,
  ].join("\n");

  return (
    <Section
      title="Presence escalation"
      description="When an agent is waiting, nudge the next online human in the chain (PH-102)."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading || busy} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh status
        </Button>
      </div>

      {watch ? (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <BellRing className="h-4 w-4" />
            <span className="font-medium">Active escalation</span>
            <Badge variant="secondary">{watch.status}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Chain: {watch.escalationChain.join(" → ")} · tier {watch.currentTierIndex + 1}/
            {watch.escalationChain.length} · interval {watch.nudgeIntervalSeconds}s
          </p>
          {watch.awaitingUserId ? (
            <p className="mt-1 text-xs text-muted-foreground">Awaiting: {watch.awaitingUserId}</p>
          ) : null}
          {watch.lastNudgedUserId ? (
            <p className="mt-1 text-xs text-muted-foreground">Last nudged: {watch.lastNudgedUserId}</p>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => void resolveEscalation()}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Resolve now
          </Button>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-xs text-muted-foreground md:col-span-2">
            Escalation chain (comma-separated user IDs)
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={chainInput}
              onChange={(e) => setChainInput(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Awaiting user (optional)
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={awaitingUserId}
              onChange={(e) => setAwaitingUserId(e.target.value)}
              placeholder="user awaiting response"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Nudge interval (seconds, min 60)
            <input
              type="number"
              min={60}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={nudgeIntervalSeconds}
              onChange={(e) => setNudgeIntervalSeconds(e.target.value)}
            />
          </label>
          <Button type="button" size="sm" className="md:col-span-2" disabled={busy} onClick={() => void startEscalation()}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BellRing className="mr-1.5 h-3.5 w-3.5" />}
            Start escalation chain
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Cron ticks every 5 minutes. Auto-resolves when a chain member posts in the room.
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">API curl</summary>
        <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          <code>{curl}</code>
        </pre>
        <div className="mt-2">
          <CopyButton text={curl} label="Copy curl" />
        </div>
      </details>

      {notice ? <p className="mt-2 text-xs text-muted-foreground">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
