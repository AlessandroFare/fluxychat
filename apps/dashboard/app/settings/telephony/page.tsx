"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, PhoneCall } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  triggerTelephonyHandoff,
  type TelephonyChannel,
  type TelephonyHandoffResult,
} from "@/lib/telephony-handoff-client";

const CHANNELS: TelephonyChannel[] = ["voice", "sms", "whatsapp"];

export default function TelephonyHandoffSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [roomId, setRoomId] = useState("");
  const [fromE164, setFromE164] = useState("");
  const [channel, setChannel] = useState<TelephonyChannel>("voice");
  const [reason, setReason] = useState("");
  const [requestVoiceSession, setRequestVoiceSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TelephonyHandoffResult | null>(null);

  async function handleTrigger() {
    if (!token || !roomId.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await triggerTelephonyHandoff(token, {
        roomId: roomId.trim(),
        fromE164: fromE164.trim() || undefined,
        channel,
        reason: reason.trim() || undefined,
        requestVoiceSession: channel === "voice" ? requestVoiceSession : false,
      });
      setResult(res);
      if (!res.ok) setError(res.error ?? "Handoff failed");
    } catch (err) {
      setError(messageFromUnknown(err, "Telephony handoff failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Telephony handoff"
        description="Route Telnyx/Twilio inbound SMS and voice into human handoff, with an optional Voice AI session."
      />

      <ConsoleFeedback error={error} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-brand" />
            <h2 className="text-sm font-semibold">Auto handoff (Worker env)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Enable automatic telephony → agent handoff on every successful telco inbound message.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
{`TELCO_INBOUND_ENABLED=true
TELEPHONY_AGENT_HANDOFF=true
TELCO_INBOUND_DEFAULT_ROOM_ID=<room-uuid>`}
          </pre>
          <p className="text-sm text-muted-foreground">
            After a voice handoff, inspect sessions on{" "}
            <Link href="/voice-ai" className="text-brand hover:underline">
              Voice AI
            </Link>{" "}
            and claim rooms in{" "}
            <Link href="/agent-queue" className="text-brand hover:underline">
              Agent queue
            </Link>
            .
          </p>
          <a
            href="/docs/guides/telephony-handoff"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            Telephony handoff runbook
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Panel>

        <Panel className="space-y-4 p-5">
          <Section title="Manual handoff trigger">
            <p className="text-sm text-muted-foreground">
              Call the same API used by telco webhooks. Useful for testing or operator-initiated escalation.
            </p>
            <RoomPicker token={token} value={roomId} onChange={setRoomId} />
            <Input
              placeholder="Caller E.164 (optional, e.g. +15551234567)"
              value={fromE164}
              onChange={(e) => setFromE164(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={channel === c ? "default" : "secondary"}
                  onClick={() => setChannel(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {channel === "voice" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestVoiceSession}
                  onChange={(e) => setRequestVoiceSession(e.target.checked)}
                />
                Open Voice AI session
              </label>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!token || !roomId.trim() || busy}
              onClick={() => void handleTrigger()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Trigger handoff
            </Button>
          </Section>
        </Panel>
      </div>

      {result?.ok ? (
        <Panel className="mt-6 space-y-3 p-5">
          <h2 className="text-sm font-semibold">Last handoff result</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant={result.handoff?.active ? "default" : "outline"}>
              Handoff {result.handoff?.active ? "active" : "inactive"}
            </Badge>
            {result.suggestedAgentUserId ? (
              <Badge variant="secondary">Suggested agent: {result.suggestedAgentUserId}</Badge>
            ) : null}
            {result.voiceSession?.sessionId ? (
              <Badge variant="secondary">Voice session: {result.voiceSession.sessionId}</Badge>
            ) : null}
          </div>
          {result.handoff?.contextSummary ? (
            <p className="text-sm text-muted-foreground">{result.handoff.contextSummary}</p>
          ) : null}
          {result.voiceSession?.wsUrl ? (
            <p className="text-xs text-muted-foreground break-all">WS: {result.voiceSession.wsUrl}</p>
          ) : null}
        </Panel>
      ) : null}
    </ConsoleShell>
  );
}
