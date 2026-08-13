"use client";

import { useCallback, useState } from "react";
import { Gavel, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Button, Section } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomDecisionQuorumPanelProps {
  roomId: string;
  memberJwt: string;
}

interface DecisionState {
  state?: string;
  totalCurrent?: number;
  totalRequired?: number;
  expiresAt?: string;
  allowedRoles?: string[];
}

export function RoomDecisionQuorumPanel({ roomId, memberJwt }: RoomDecisionQuorumPanelProps) {
  const [content, setContent] = useState("Approve production deploy v2.4.1?");
  const [requiredAcks, setRequiredAcks] = useState("2");
  const [messageId, setMessageId] = useState<number | null>(null);
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useCallback(
    () =>
      new FluxyChatClient({
        baseUrl: getPublicWorkerUrl(),
        userId: "dashboard-member",
        token: memberJwt,
      }),
    [memberJwt],
  );

  async function refreshDecision(id: number) {
    const payload = (await client().getDecision(id)) as DecisionState;
    setDecision(payload);
  }

  async function propose() {
    if (!memberJwt.trim()) return;
    setBusy(true);
    setError(null);
    setDecision(null);
    try {
      const res = await client().createDecision(roomId, {
        content: content.trim(),
        requiredAcks: Math.max(1, Number(requiredAcks) || 1),
        allowedRoles: ["admin", "owner"],
        ttlSeconds: 3600,
      });
      const id = Number((res.message as { id?: number })?.id);
      if (Number.isFinite(id)) {
        setMessageId(id);
        await refreshDecision(id);
      }
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create decision"));
    } finally {
      setBusy(false);
    }
  }

  async function ack() {
    if (!memberJwt.trim() || messageId == null) return;
    setBusy(true);
    setError(null);
    try {
      await client().ackDecision(messageId);
      await refreshDecision(messageId);
    } catch (err) {
      setError(messageFromUnknown(err, "Ack failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Critical action quorum"
      description="High-risk actions need N admin/owner acks before they count as decided (PH-110)."
    >
      <textarea
        className="min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe the action requiring approval"
      />
      <label className="mt-2 block text-xs text-muted-foreground">
        Required admin/owner acks
        <input
          type="number"
          min={1}
          className="mt-1 w-24 rounded-md border bg-background px-2 py-1 text-sm"
          value={requiredAcks}
          onChange={(e) => setRequiredAcks(e.target.value)}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void propose()}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Gavel className="mr-1.5 h-3.5 w-3.5" />}
          Propose
        </Button>
        {messageId != null ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void ack()}>
              Ack as me
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void refreshDecision(messageId)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh status
            </Button>
          </>
        ) : null}
      </div>

      {messageId != null ? (
        <p className="mt-2 text-xs text-muted-foreground">Decision message #{messageId}</p>
      ) : null}

      {decision ? (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Status</span>
            <Badge variant={decision.state === "decided" ? "default" : "secondary"}>
              {decision.state ?? "pending"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Acks: {decision.totalCurrent ?? 0} / {decision.totalRequired ?? requiredAcks}
            {decision.expiresAt ? ` · expires ${new Date(decision.expiresAt).toLocaleString()}` : null}
          </p>
          {decision.allowedRoles?.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Allowed roles: {decision.allowedRoles.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
