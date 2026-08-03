"use client";

import { useMemo, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { AgentToolCallDisplay } from "@/lib/agent-run-display";

interface CounterfactualReplayPanelProps {
  toolCall: AgentToolCallDisplay;
  runId: string;
  sideEffectHint?: boolean;
  onReplay: (modifiedParams: Record<string, unknown>, dryRun: boolean) => Promise<void>;
  onCancel: () => void;
}

export function CounterfactualReplayPanel({
  toolCall,
  runId,
  sideEffectHint,
  onReplay,
  onCancel,
}: CounterfactualReplayPanelProps) {
  const initialJson = useMemo(() => {
    try {
      const parsed = JSON.parse(toolCall.arguments || "{}");
      return JSON.stringify(parsed, null, 2);
    } catch {
      return toolCall.arguments || "{}";
    }
  }, [toolCall.arguments]);

  const [paramsJson, setParamsJson] = useState(initialJson);
  const [dryRun, setDryRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(paramsJson) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Params must be a JSON object.");
        return;
      }
    } catch {
      setError("Invalid JSON — fix syntax before replaying.");
      return;
    }
    setLoading(true);
    try {
      await onReplay(parsed, dryRun);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Try alternative — <code>{toolCall.name}</code>
      </h4>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Run <span className="font-mono">{runId.slice(0, 8)}…</span> with edited tool params. Original timeline stays intact.
      </p>
      {sideEffectHint ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          Side-effect tool — replay always uses dry-run mode (no real email/payment).
        </p>
      ) : null}
      <textarea
        className="mt-2 min-h-[120px] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
        value={paramsJson}
        onChange={(e) => setParamsJson(e.target.value)}
        spellCheck={false}
      />
      {!sideEffectHint ? (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry-run only (no side effects)
        </label>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => void handleSubmit()}>
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Replay tool
        </Button>
      </div>
    </div>
  );
}
