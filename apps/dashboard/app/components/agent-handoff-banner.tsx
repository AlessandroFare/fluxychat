"use client";

import { useCallback, useEffect, useState } from "react";
import { Headphones, Bot } from "lucide-react";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { Button } from "./ui";

interface HandoffState {
  status: string;
  active: boolean;
  handedOffByUserId?: string | null;
  handedOffAt?: string | null;
  contextSummary?: string | null;
  agentTaskId?: string | null;
}

interface DispositionOption {
  code: string;
  label: string;
}

export interface AgentHandoffBannerProps {
  roomId: string;
  agentId: string;
  agentName: string;
  /** Admin or moderator JWT for handoff mutations. */
  operatorJwt?: string;
}

export function AgentHandoffBanner({
  roomId,
  agentId,
  agentName,
  operatorJwt = "",
}: AgentHandoffBannerProps) {
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [dispositions, setDispositions] = useState<DispositionOption[]>([]);
  const [disposition, setDisposition] = useState("resolved");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!operatorJwt.trim() || !roomId.trim()) return;
    try {
      const json = await fetchWorkerJson<{
        handoff: HandoffState;
        dispositions?: DispositionOption[];
      }>(`${getPublicWorkerUrl()}/rooms/${encodeURIComponent(roomId)}/handoff`, {
        headers: { Authorization: `Bearer ${operatorJwt.trim()}` },
      });
      setHandoff(json.handoff);
      if (json.dispositions?.length) setDispositions(json.dispositions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load handoff state");
    }
  }, [operatorJwt, roomId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleTakeOver() {
    if (!operatorJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetchWorkerJson(`${getPublicWorkerUrl()}/rooms/${encodeURIComponent(roomId)}/handoff`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${operatorJwt.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agentId }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!operatorJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetchWorkerJson(`${getPublicWorkerUrl()}/rooms/${encodeURIComponent(roomId)}/handoff`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${operatorJwt.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ disposition }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete handoff");
    } finally {
      setLoading(false);
    }
  }

  if (!operatorJwt.trim()) return null;

  if (handoff?.active) {
    return (
      <div className="mb-3 space-y-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Headphones className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Human handoff active
            {handoff.handedOffByUserId ? ` · ${handoff.handedOffByUserId}` : ""}
          </span>
        </div>
        {handoff.contextSummary ? (
          <pre className="max-h-24 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground whitespace-pre-wrap">
            {handoff.contextSummary}
          </pre>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
          >
            {(dispositions.length
              ? dispositions
              : [{ code: "resolved", label: "Resolved" }]
            ).map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => void handleComplete()} disabled={loading}>
            Complete handoff
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-sm shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <Bot className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>{agentName}</strong> can respond in this room. Take over to pause AI invokes.
        </span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => void handleTakeOver()} disabled={loading}>
        Take over
      </Button>
      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
