"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Loader2, Plus, Shield, Tag } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, EmptyState, Input, Panel, Section, SkeletonCard, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  classifyRoom,
  createClassificationLabel,
  createExportSnapshot,
  createLegalHold,
  createRetentionPolicy,
  deleteClassificationLabel,
  getRoomClassification,
  listClassificationLabels,
  listExportSnapshots,
  listLegalHolds,
  listRetentionPolicies,
  releaseLegalHold,
  type ClassificationLabel,
  type ExportSnapshot,
  type LegalHold,
  type RetentionPolicy,
  type RoomClassification,
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
  const [labels, setLabels] = useState<ClassificationLabel[]>([]);
  const [roomClassification, setRoomClassification] = useState<RoomClassification | null>(null);

  const [labelName, setLabelName] = useState("");
  const [labelLevel, setLabelLevel] = useState(1);
  const [labelColor, setLabelColor] = useState("#64748b");
  const [classifyRoomId, setClassifyRoomId] = useState("");
  const [classifyLabelId, setClassifyLabelId] = useState("");

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
      const [p, h, s, l] = await Promise.all([
        listRetentionPolicies(token),
        listLegalHolds(token),
        listExportSnapshots(token),
        listClassificationLabels(token),
      ]);
      setPolicies(p.policies ?? []);
      setHolds(h.holds ?? []);
      setSnapshots(s.snapshots ?? []);
      setLabels(l.labels ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load retention data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Async boundary: keeps the effect body free of synchronous setState.
      await Promise.resolve();
      if (!cancelled) await loadAll();
    })();
    return () => {
      cancelled = true;
    };
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

  async function handleCreateLabel() {
    if (!token || !labelName.trim()) return;
    setBusy("label");
    try {
      await createClassificationLabel(token, {
        name: labelName.trim(),
        level: labelLevel,
        color: labelColor,
      });
      setLabelName("");
      setNotice("Classification label created.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create classification label"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteLabel(labelId: string) {
    if (!token || !confirm("Delete this label? Existing classifications will keep the old label id.")) return;
    try {
      await deleteClassificationLabel(token, labelId);
      if (classifyLabelId === labelId) setClassifyLabelId("");
      setNotice("Classification label deleted.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to delete classification label"));
    }
  }

  async function handleClassifyRoomChange(roomId: string) {
    setClassifyRoomId(roomId);
    setRoomClassification(null);
    if (!token || !roomId) return;
    try {
      const result = await getRoomClassification(token, roomId);
      setRoomClassification(result.classification);
      if (result.classification) setClassifyLabelId(result.classification.labelId);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room classification"));
    }
  }

  async function handleClassifyRoom() {
    if (!token || !classifyRoomId || !classifyLabelId) return;
    setBusy("classify");
    try {
      const result = await classifyRoom(token, classifyRoomId, classifyLabelId);
      setRoomClassification(result);
      setNotice("Room classification updated.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to classify room"));
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
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
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
              <EmptyState
                compact
                className="mt-4"
                title="No retention policies"
                description="Add one above to set how long messages are kept."
              />
            ) : (
              <ul className="mt-4 divide-y rounded-lg bg-card shadow-[var(--shadow-2)]">
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

          <Section title="Data classification">
            <p className="mb-3 text-sm text-muted-foreground">
              Project-scoped labels. One label per room; message-level overrides remain available through the
              Worker API.
            </p>
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <Input
                aria-label="Label name"
                placeholder="Label name"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
              />
              <select
                aria-label="Classification level"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={labelLevel}
                onChange={(e) => setLabelLevel(Number(e.target.value))}
              >
                <option value={0}>Level 0 · Public</option>
                <option value={1}>Level 1 · Internal</option>
                <option value={2}>Level 2 · Confidential</option>
                <option value={3}>Level 3 · Restricted</option>
              </select>
              <input
                aria-label="Label color"
                type="color"
                className="h-9 w-12 rounded-md border border-border bg-background p-1"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
              />
              <Button size="sm" disabled={busy === "label"} onClick={() => void handleCreateLabel()}>
                {busy === "label" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="mr-2 h-4 w-4" />
                )}
                Add label
              </Button>
            </div>
            {labels.length === 0 ? (
              <EmptyState
                compact
                title="No classification labels"
                description="Add one above to classify rooms in this project."
              />
            ) : (
              <ul className="divide-y rounded-lg bg-card shadow-[var(--shadow-2)]">
                {labels.map((label) => (
                  <li key={label.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-3 rounded-full border border-border"
                        style={{ backgroundColor: label.color ?? "#94a3b8" }}
                      />
                      <span className="font-medium">{label.name}</span>
                      <span className="text-muted-foreground">Level {label.level}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete ${label.name}`}
                      onClick={() => void handleDeleteLabel(label.id)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 rounded-lg bg-card p-4 shadow-[var(--shadow-2)]">
              <h3 className="text-sm font-medium">Classify a room</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <RoomPicker
                  token={token}
                  allowEmpty
                  emptyLabel="Select room"
                  value={classifyRoomId}
                  onChange={(roomId) => void handleClassifyRoomChange(roomId)}
                  placeholder="Room"
                />
                <select
                  aria-label="Room classification label"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={classifyLabelId}
                  onChange={(e) => setClassifyLabelId(e.target.value)}
                >
                  <option value="">Select label</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name} (level {label.level})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!classifyRoomId || !classifyLabelId || busy === "classify"}
                  onClick={() => void handleClassifyRoom()}
                >
                  {busy === "classify" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply label
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {classifyRoomId
                  ? roomClassification
                    ? `Current: ${
                        labels.find((label) => label.id === roomClassification.labelId)?.name ??
                        roomClassification.labelId
                      }`
                    : "No label on this room yet."
                  : "Choose a room to see its current label."}
              </p>
            </div>
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
              <EmptyState
                compact
                className="mt-4"
                title="No active holds"
                description="A legal hold freezes deletion until it is released."
              />
            ) : (
              <ul className="mt-4 divide-y rounded-lg bg-card shadow-[var(--shadow-2)]">
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
              <EmptyState
                compact
                className="mt-4"
                title="No export snapshots"
                description="Request one above to record a chain-of-custody export job."
              />
            ) : (
              <ul className="mt-4 divide-y rounded-lg bg-card shadow-[var(--shadow-2)]">
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
