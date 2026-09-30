"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Section } from "./ui";
import {
  fetchRoomSystemOneDecisions,
  type RoomSystemOneDecision,
} from "@/lib/hitl-approval-client";
import { messageFromUnknown } from "@/lib/error-message";

function modelCounts(rows: RoomSystemOneDecision[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = row.model || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export function RoomDecisionsPanel({ roomId, memberJwt }: { roomId: string; memberJwt: string }) {
  const [rows, setRows] = useState<RoomSystemOneDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!memberJwt.trim() || !roomId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRoomSystemOneDecisions(memberJwt, roomId, 40));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room decisions"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => modelCounts(rows), [rows]);

  return (
    <Section
      title="Room Decisions"
      description="System One and deterministic gates. Counts by model are not a significance test and not an A/B winner."
    >
      <p className="text-xs text-muted-foreground">
        Labels for tenant-local fine-tunes later. Apply D1 migration 0228. Empty until the room has scored turns.
      </p>
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={loading} onClick={() => void load()}>
        Refresh
      </Button>
      {Object.keys(counts).length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Models in this page:{" "}
          {Object.entries(counts)
            .map(([k, n]) => `${k} (${n})`)
            .join(", ")}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1 pr-2 font-medium">When</th>
              <th className="py-1 pr-2 font-medium">Kind</th>
              <th className="py-1 pr-2 font-medium">Choice</th>
              <th className="py-1 pr-2 font-medium">Model</th>
              <th className="py-1 pr-2 font-medium">Mode</th>
              <th className="py-1 pr-2 font-medium">Human</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-3 text-muted-foreground">
                  No rows yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-1 pr-2 whitespace-nowrap">{row.createdAt?.replace("T", " ").slice(0, 19)}</td>
                <td className="py-1 pr-2">{row.kind}</td>
                <td className="py-1 pr-2">
                  {row.choice}
                  {row.noul != null ? ` noul=${Number(row.noul).toFixed(2)}` : ""}
                </td>
                <td className="py-1 pr-2">
                  {row.model || "—"}
                  {row.cascadedFrom ? ` via ${row.cascadedFrom}` : ""}
                </td>
                <td className="py-1 pr-2">{row.mode}</td>
                <td className="py-1 pr-2">{row.humanOutcome || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
