"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Loader2, Plus, Shield } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createExportSnapshot,
  createLegalHold,
  createRetentionPolicy,
  listExportSnapshots,
  listLegalHolds,
  listRetentionPolicies,
  releaseLegalHold,
  type ExportSnapshot,
  type LegalHold,
  type RetentionPolicy,
} from "@/lib/retention-client";

export default function RetentionSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [holds, setHolds] = useState<LegalHold[]>([]);
  const [snapshots, setSnapshots] = useState<ExportSnapshot[]>([]);

  const [policyName, setPolicyName] = useState("");
  const [policyDays, setPolicyDays] = useState(365);
  const [policyRoomId, setPolicyRoomId] = useState("");

  const [holdRoomId, setHoldRoomId] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [exportRoomId, setExportRoomId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, h, s] = await Promise.all([
        listRetentionPolicies(token),
        listLegalHolds(token),
        listExportSnapshots(token),
      ]);
      setPolicies(p.policies ?? []);
      setHolds(h.holds ?? []);
      setSnapshots(s.snapshots ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load retention data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreatePolicy() {
    if (!token || !policyName.trim()) return;
    setBusy("policy");
    try {
      await createRetentionPolicy(token, {
        name: policyName.trim(),
        roomId: policyRoomId.trim() || undefined,
        retentionDays: policyDays,
        autoDelete: false,
      });
      setPolicyName("");
      setNotice("Retention policy created.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create policy"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateHold() {
    if (!token || !holdReason.trim()) return;
    setBusy("hold");
    try {
      await createLegalHold(token, {
        roomId: holdRoomId.trim() || undefined,
        reason: holdReason.trim(),
      });
      setHoldReason("");
      setNotice("Legal hold placed.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create legal hold"));
    } finally {
      setBusy(null);
    }
  }

  async function handleReleaseHold(holdId: string) {
    if (!token || !confirm("Release this legal hold?")) return;
    try {
      await releaseLegalHold(token, holdId);
      setNotice("Legal hold released.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to release hold"));
    }
  }

  async function handleExportSnapshot() {
    if (!token) return;
    setBusy("export");
    try {
      await createExportSnapshot(token, {
        roomId: exportRoomId.trim() || undefined,
        format: "json",
      });
      setNotice("Export snapshot requested (chain-of-custody record).");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create export snapshot"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Retention & legal hold"
        description="Retention policies, active legal holds, and compliance export snapshots."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
          ← Back to settings
        </Link>
        {" · "}
        <Link href="/soc2" className="font-medium underline-offset-4 hover:underline">
          SOC 2 exports
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required from{" "}
          <Link href="/projects" className="font-medium underline-offset-2 hover:underline">
            Projects
          </Link>
          .
        </Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Retention policies">
            <div className="mb-4 grid gap-2 md:grid-cols-3">
              <Input placeholder="Policy name" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
              <Input
                type="number"
                min={1}
                placeholder="Days"
                value={policyDays}
                onChange={(e) => setPolicyDays(Number(e.target.value) || 365)}
              />
              <RoomPicker token={token} allowEmpty emptyLabel="Project-wide" value={policyRoomId} onChange={setPolicyRoomId} placeholder="Room (optional)" />
            </div>
            <Button size="sm" disabled={busy === "policy"} onClick={() => void handleCreatePolicy()}>
              {busy === "policy" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add policy
            </Button>
            {policies.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No policies yet.</p>
            ) : (
              <ul className="mt-4 divide-y rounded-lg border border-black/[0.06] bg-white/90">
                {policies.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {p.retentionDays}d · {p.roomId ?? "project-wide"}
                    </span>
                    {!p.enabled ? <Badge className="ml-2" variant="outline">disabled</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Legal holds">
            <Textarea
              rows={2}
              placeholder="Reason for hold (audit trail)"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <RoomPicker token={token} allowEmpty emptyLabel="Project-wide" value={holdRoomId} onChange={setHoldRoomId} placeholder="Room (optional)" />
              <Button size="sm" disabled={busy === "hold"} onClick={() => void handleCreateHold()}>
                {busy === "hold" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Place hold
              </Button>
            </div>
            {holds.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No active holds.</p>
            ) : (
              <ul className="mt-4 divide-y rounded-lg border border-black/[0.06] bg-white/90">
                {holds.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{h.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.roomId ?? "all rooms"} · {formatDateTime(h.createdAt)} · by {h.placedBy}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleReleaseHold(h.id)}>
                      Release
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Chain-of-custody export snapshots">
            <p className="mb-3 text-sm text-muted-foreground">
              Creates a recorded export job for e-discovery. Full case workflow:{" "}
              <code className="text-xs">/admin/ediscovery</code> API.
            </p>
            <RoomPicker token={token} allowEmpty emptyLabel="All rooms" value={exportRoomId} onChange={setExportRoomId} placeholder="Room filter (optional)" />
            <Button className="mt-2" size="sm" disabled={busy === "export"} onClick={() => void handleExportSnapshot()}>
              {busy === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Request snapshot
            </Button>
            {snapshots.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No snapshots yet.</p>
            ) : (
              <ul className="mt-4 divide-y rounded-lg border border-black/[0.06] bg-white/90">
                {snapshots.map((s) => (
                  <li key={s.id} className="px-4 py-3 text-sm">
                    <Badge variant="outline" className="mr-2">{s.status}</Badge>
                    {s.format} · {s.roomId ?? "project"} · {formatDateTime(s.createdAt)}
                    {s.messageCount ? ` · ${s.messageCount} messages` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
