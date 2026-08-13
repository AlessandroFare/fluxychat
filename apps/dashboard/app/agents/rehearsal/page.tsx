"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Play, Theater, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createRehearsal,
  deleteRehearsal,
  listRehearsals,
  type RehearsalRoom,
} from "@/lib/rehearsal-rooms-client";

export default function RehearsalRoomsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rehearsals, setRehearsals] = useState<RehearsalRoom[]>([]);
  const [sourceRoomId, setSourceRoomId] = useState("");
  const [statedGoal, setStatedGoal] = useState("Practice the pricing negotiation before tomorrow's call");
  const [counterpartyRole, setCounterpartyRole] = useState("Skeptical procurement lead");
  const [agentId, setAgentId] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await listRehearsals(token, {
        sourceRoomId: sourceRoomId.trim() || undefined,
      });
      setRehearsals(result.rehearsals ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load rehearsals"));
    } finally {
      setLoading(false);
    }
  }, [token, sourceRoomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token || !sourceRoomId.trim()) {
      setError("Source room ID is required");
      return;
    }
    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      const result = await createRehearsal(token, sourceRoomId.trim(), {
        statedGoal: statedGoal.trim() || undefined,
        counterpartyRole: counterpartyRole.trim() || undefined,
        agentId: agentId.trim() || undefined,
      });
      setNotice(`Rehearsal created. Open room ${result.rehearsal.rehearsalRoomId}.`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create rehearsal"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(rehearsalId: string) {
    if (!token) return;
    setBusy(rehearsalId);
    try {
      await deleteRehearsal(token, rehearsalId);
      setNotice("Rehearsal deleted");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Rehearsal rooms"
        description="Clone authorized room context into an ephemeral private room. Agents simulate a counterparty, not the real person."
        icon={Theater}
      />

      <ConsoleFeedback error={error} notice={notice} />

      <Section title="Start a rehearsal" description="Only messages you can already access are copied. Sessions expire after 1 hour by default.">
        <Panel className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Source room ID</span>
              <Input value={sourceRoomId} onChange={(e) => setSourceRoomId(e.target.value)} placeholder="room uuid" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Agent ID (optional)</span>
              <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="bot id for simulation" />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Counterparty role</span>
            <Input value={counterpartyRole} onChange={(e) => setCounterpartyRole(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Session goal</span>
            <Input value={statedGoal} onChange={(e) => setStatedGoal(e.target.value)} />
          </label>
          <Button onClick={() => void handleCreate()} disabled={busy === "create" || !sourceRoomId.trim()}>
            {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Create rehearsal room
          </Button>
        </Panel>
      </Section>

      <Section title="Your rehearsals" description="Active and recent sessions for this project.">
        <Panel>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rehearsals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rehearsals yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rehearsals.map((r) => (
                <li key={r.rehearsalId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.rehearsalRoomId}</span>
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From {r.sourceRoomId} · {r.snapshotMessageCount} messages · expires {formatDateTime(r.expiresAt)}
                    </p>
                    {r.counterpartyRole ? (
                      <p className="text-xs text-muted-foreground">Role: {r.counterpartyRole}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/rooms?room=${encodeURIComponent(r.rehearsalRoomId)}`}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted/60"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(r.rehearsalId)}
                      disabled={busy === r.rehearsalId}
                    >
                      {busy === r.rehearsalId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
    </ConsoleShell>
  );
}
