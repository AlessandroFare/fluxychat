"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui";
import { MergeConflictCompare } from "~/components/ui/merge-conflict-compare";
import {
  listMergeConflicts,
  resolveMergeConflict,
  type MergeConflictRow,
} from "@/lib/merge-conflict-client";
import { messageFromUnknown } from "@/lib/error-message";

export interface MergeConflictPanelProps {
  token: string;
  roomId: string;
  onResolved?: () => void;
}

export function MergeConflictPanel({ token, roomId, onResolved }: MergeConflictPanelProps) {
  const [conflicts, setConflicts] = useState<MergeConflictRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token.trim() || !roomId.trim()) {
      setConflicts([]);
      return;
    }
    try {
      const res = await listMergeConflicts(token.trim(), roomId.trim());
      setConflicts(res.conflicts ?? []);
      setError(null);
    } catch {
      setConflicts([]);
    }
  }, [token, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(conflictId: string, resolution: "keep_a" | "keep_b" | "merge_both") {
    setBusy(`${conflictId}:${resolution}`);
    setError(null);
    try {
      await resolveMergeConflict(token.trim(), conflictId, resolution);
      await load();
      onResolved?.();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to resolve conflict"));
    } finally {
      setBusy(null);
    }
  }

  if (!conflicts.length) return null;

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-amber-500/40 bg-amber-50/50 p-3 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-950 dark:text-amber-50">
        <GitMerge className="h-4 w-4" />
        {conflicts.length} merge conflict{conflicts.length === 1 ? "" : "s"} need resolution
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="space-y-2 rounded-md border border-border/50 bg-background/60 p-2">
          <MergeConflictCompare conflict={conflict} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={() => void handleResolve(conflict.id, "keep_a")}
            >
              {busy === `${conflict.id}:keep_a` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Keep A
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={() => void handleResolve(conflict.id, "keep_b")}
            >
              Keep B
            </Button>
            <Button
              size="sm"
              disabled={!!busy}
              onClick={() => void handleResolve(conflict.id, "merge_both")}
            >
              Merge both
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
