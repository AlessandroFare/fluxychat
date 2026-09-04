"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Flag, Loader2, Shield, VolumeX } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { RoomPicker } from "../components/room-picker";
import { Button, Input, Section, Textarea } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

interface QueueEvent {
  id: string;
  roomId: string;
  messageId?: number;
  userId?: string;
  content?: string;
  severity: string;
  categories: string[];
  reason?: string;
  confidence?: number;
  suggestedAction?: string;
  createdAt: string;
}

interface ModerationTrends {
  severityBreakdown?: Array<{ severity: string; count: number }>;
  categoryBreakdown?: Array<{ category: string; count: number }>;
}

interface FeedbackStats {
  total?: number;
  truePositive?: number;
  falsePositive?: number;
  uncertain?: number;
}

interface ReviewHistoryItem extends QueueEvent {
  reviewedBy?: string;
  reviewedAt?: string;
  reviewAction?: string;
  reviewNotes?: string;
}

async function callAdmin(action: "mute" | "ban", body: Record<string, unknown>, jwt: string) {
  return fetchWorkerJson(`${WORKER_URL}/admin/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
}

export default function ModerationPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [queue, setQueue] = useState<QueueEvent[]>([]);
  const [trends, setTrends] = useState<ModerationTrends | null>(null);
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muteUserId, setMuteUserId] = useState("");
  const [muteDuration, setMuteDuration] = useState(3600);
  const [reviewNotes, setReviewNotes] = useState("");

  const loadData = useCallback(async () => {
    if (!token) {
      setError("Select a session from Projects or Onboarding.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const queueUrl = new URL(`${WORKER_URL}/moderation-queue/priority`);
      queueUrl.searchParams.set("pending", "true");
      queueUrl.searchParams.set("limit", "50");
      if (roomId.trim()) queueUrl.searchParams.set("room_id", roomId.trim());

      const trendsUrl = new URL(`${WORKER_URL}/intelligence/analytics/moderation`);
      if (roomId.trim()) trendsUrl.searchParams.set("room_id", roomId.trim());

      const [queueJson, trendsJson, feedbackJson, historyJson] = await Promise.all([
        fetchWorkerJson<{ events?: QueueEvent[] }>(queueUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchWorkerJson<{ trends?: ModerationTrends }>(trendsUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ trends: null })),
        fetchWorkerJson<{ stats?: FeedbackStats }>(`${WORKER_URL}/moderation-queue/feedback/stats?days=30`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ stats: null })),
        fetchWorkerJson<{ history?: ReviewHistoryItem[] }>(`${WORKER_URL}/moderation-queue/review-history?limit=25`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ history: [] })),
      ]);

      setQueue(queueJson.events ?? []);
      setTrends(trendsJson.trends ?? null);
      setFeedback(feedbackJson.stats ?? null);
      setHistory(historyJson.history ?? []);
      setNotice(`Loaded ${queueJson.events?.length ?? 0} pending items.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load moderation queue"));
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    if (token) void loadData();
  }, [token, loadData]);

  async function bulkReview(action: string, overrideAction?: string) {
    if (!token || selected.size === 0) return;
    const count = selected.size;
    try {
      setError(null);
      await fetchWorkerJson(`${WORKER_URL}/moderation-queue/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventIds: Array.from(selected),
          action,
          overrideAction,
          notes: reviewNotes.trim() || undefined,
        }),
      });
      setSelected(new Set());
      setReviewNotes("");
      setNotice(`Reviewed ${count} item(s) (${action}${overrideAction ? `: ${overrideAction}` : ""}).`);
      await loadData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Bulk review failed"));
    }
  }

  async function escalateMuteBan(kind: "mute" | "ban") {
    if (!adminJwt.trim() || !roomId.trim() || !muteUserId.trim()) {
      setError("Admin JWT, room, and user ID required for mute/ban.");
      return;
    }
    try {
      const body: Record<string, unknown> = { roomId: roomId.trim(), userId: muteUserId.trim(), reason: "moderation_dashboard" };
      if (kind === "mute") body.durationSeconds = muteDuration;
      await callAdmin(kind, body, adminJwt.trim());
      setNotice(`${kind === "mute" ? "Muted" : "Banned"} @${muteUserId.trim()}.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, `${kind} failed`));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const fpRate =
    feedback && feedback.total && feedback.total > 0
      ? ((feedback.falsePositive ?? 0) / feedback.total) * 100
      : null;

  const flaggedTotal =
    trends?.severityBreakdown?.reduce((sum, row) => sum + Number(row.count || 0), 0) ?? null;
  const topCategory = trends?.categoryBreakdown?.[0]?.category ?? null;

  return (
    <ConsoleShell className="max-w-6xl lg:max-w-6xl">
      <ConsolePageHeader
        title="Moderation"
        description={
          <>
            Review flagged messages, profanity auto-flags, and escalation queue. Mute/ban via{" "}
            <Link href="/admin" className="underline underline-offset-2">
              Admin
            </Link>{" "}
            or inline below.
          </>
        }
      />
      <ConsoleFeedback error={error} notice={notice} className="space-y-3" />

      <Section
        title="Queue filters"
        actions={
          <Button onClick={() => void loadData()} disabled={loading || !token}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        }
      >
        <div className="max-w-md">
          <RoomPicker token={token} value={roomId} onChange={setRoomId} placeholder="All rooms (optional filter)" />
        </div>
      </Section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pending review" value={String(queue.length)} icon={Flag} />
        <StatTile label="Queue total (period)" value={flaggedTotal != null ? String(flaggedTotal) : "—"} icon={AlertTriangle} />
        <StatTile label="Top category" value={topCategory ?? "—"} icon={Shield} />
        <StatTile
          label="False positive rate"
          value={fpRate != null ? `${fpRate.toFixed(1)}%` : "—"}
          icon={VolumeX}
          hint={feedback ? `${feedback.falsePositive ?? 0} / ${feedback.total ?? 0} reviews` : undefined}
        />
      </div>

      <Section title="Escalation queue (HITL)" className="mt-8">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending moderation events.</p>
        ) : (
          <div className="space-y-2">
            {queue.map((event) => (
              <label
                key={event.id}
                className="flex cursor-pointer gap-3 rounded-lg bg-card shadow-[var(--shadow-2)] p-3 hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={selected.has(event.id)}
                  onChange={() => toggleSelect(event.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.severity}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{event.roomId}</span>
                    {event.confidence != null ? (
                      <span className="text-xs text-muted-foreground">{(event.confidence * 100).toFixed(0)}% conf</span>
                    ) : null}
                  </div>
                  {event.content ? <p className="mt-1 truncate text-sm">{event.content}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.reason || event.suggestedAction || "flagged"} · {formatDateTime(event.createdAt)}
                  </p>
                  {event.categories.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {event.categories.map((c) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        )}

        {selected.size > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-end">
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes (optional)"
              className="min-h-[60px] flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void bulkReview("confirm")}>
                Confirm suggested
              </Button>
              <Button size="sm" variant="neutral" onClick={() => void bulkReview("override", "warn")}>
                Override: warn
              </Button>
              <Button size="sm" variant="neutral" onClick={() => void bulkReview("override", "mute")}>
                Override: mute
              </Button>
              <Button size="sm" variant="neutral" onClick={() => void bulkReview("override", "delete")}>
                Override: delete
              </Button>
              <Button size="sm" variant="neutral" onClick={() => void bulkReview("dismiss")}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Manual mute / ban" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={muteUserId} onChange={(e) => setMuteUserId(e.target.value)} placeholder="User ID" />
          <Input
            type="number"
            value={muteDuration}
            onChange={(e) => setMuteDuration(Number(e.target.value))}
            placeholder="Mute seconds"
          />
          <Button variant="neutral" onClick={() => void escalateMuteBan("mute")} disabled={!adminJwt.trim()}>
            <VolumeX className="mr-2 h-4 w-4" /> Mute
          </Button>
          <Button variant="neutral" onClick={() => void escalateMuteBan("ban")} disabled={!adminJwt.trim()}>
            <Ban className="mr-2 h-4 w-4" /> Ban
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Requires admin JWT and room filter above.</p>
      </Section>

      <Section title="Review history" className="mt-8" description="Recent moderator actions logged server-side.">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed items yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {history.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.reviewAction || "reviewed"}</Badge>
                  <Badge variant="secondary">{item.severity}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{item.roomId}</span>
                </div>
                {item.content ? <p className="mt-1 truncate">{item.content}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.reviewedBy ? `by ${item.reviewedBy}` : "moderator"} · {item.reviewedAt ? formatDateTime(item.reviewedAt) : "—"}
                  {item.reviewNotes ? ` · ${item.reviewNotes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </ConsoleShell>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
