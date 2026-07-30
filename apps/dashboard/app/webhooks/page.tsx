"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, BookOpen } from "lucide-react";
import Link from "next/link";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Section, SkeletonCard } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { formatDateTime } from "@/lib/format-datetime";

const WORKER_URL = getPublicWorkerUrl();

interface WebhookSummary {
  webhookId: string;
  url: string;
  eventTypes: string;
  webhookCreatedAt: string;
  lastDelivery:
    | {
        id: string;
        status: string;
        lastHttpStatus: number | null;
        lastError: string | null;
        deliveredAt: string | null;
        createdAt: string;
      }
    | null;
  consecutiveFailures: number;
}

function statusBadge(s: WebhookSummary): { label: string; tone: "ok" | "warn" | "danger" | "muted" } {
  if (!s.lastDelivery) return { label: "No deliveries", tone: "muted" };
  if (s.lastDelivery.status === "delivered") return { label: "Healthy", tone: "ok" };
  if (s.lastDelivery.status === "pending" || s.lastDelivery.status === "retrying")
    return { label: "In flight", tone: "muted" };
  if (s.lastDelivery.status === "failed") return { label: "Failing", tone: "danger" };
  if (s.lastDelivery.status === "cancelled") return { label: "Cancelled", tone: "muted" };
  return { label: s.lastDelivery.status, tone: "muted" };
}

const TONE_CLASS: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  muted: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function WebhooksPage() {
  const { adminJwt, activeProject } = useDashboardSession();
  const [webhooks, setWebhooks] = useState<WebhookSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminJwt.trim()) {
      setError("Mint an admin JWT in Quickstart to manage webhooks.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkerJson<{ webhooks: WebhookSummary[] }>(
        `${WORKER_URL}/admin/webhooks/summary`,
        { headers: { Authorization: `Bearer ${adminJwt.trim()}` } },
      );
      setWebhooks(data?.webhooks ?? []);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load webhooks"));
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, [adminJwt]);

  useEffect(() => {
    if (activeProject?.id) void load();
  }, [activeProject?.id, load]);

  const hasFailing = (webhooks ?? []).some((w) => w.consecutiveFailures >= 3);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Webhooks"
        description="Outbound HTTP endpoints that receive FluxyChat events. Add an endpoint to get notified about messages, mentions, and room changes."
      />

      {error ? <Banner variant="error">{error}</Banner> : null}
      {hasFailing ? (
        <Banner variant="warn">
          One or more webhooks have failed 3 or more times in a row. Check the
          endpoint and verify it accepts the payload schema documented in the
          worker README.
        </Banner>
      ) : null}

      <Section
        title="Endpoints"
        description="Each row is a registered webhook. The badge shows the last delivery outcome; an amber pill means 3+ consecutive failures."
      >
        {loading && webhooks == null ? (
          <div className="flex flex-col gap-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : webhooks == null ? null : webhooks.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No webhooks yet"
            description="Register an endpoint to receive chat events. We'll sign each delivery with your webhook secret."
            action={{
              label: "Read the webhook docs",
              href: "https://github.com/AlessandroFare/fluxychat#webhooks",
            }}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {webhooks.map((w) => {
              const badge = statusBadge(w);
              const failing = w.consecutiveFailures >= 3;
              return (
                <li
                  key={w.webhookId}
                  className="flex flex-col gap-2 rounded-xl border border-black/[0.06] bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-slate-800">
                        {w.url}
                      </code>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASS[badge.tone]}`}
                      >
                        {badge.tone === "ok" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                        ) : failing ? (
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                        ) : null}
                        {badge.label}
                        {failing ? ` · ${w.consecutiveFailures}x` : ""}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Events: {w.eventTypes || "all"} · Added{" "}
                      {formatDateTime(w.webhookCreatedAt)}
                    </p>
                    {w.lastDelivery?.lastError ? (
                      <p className="mt-1 truncate text-xs text-red-700">
                        Last error: {w.lastDelivery.lastError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    {w.lastDelivery ? (
                      <span className="text-xs text-muted-foreground">
                        Last delivery: {formatDateTime(w.lastDelivery.createdAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Awaiting first delivery
                      </span>
                    )}
                    <Link
                      href={`/admin/webhooks/${w.webhookId}`}
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Details <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </Section>

      <Section title="Event catalog" description="All 17 webhook event types available via createWebhookEventCatalog() SDK module.">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { cat: "Messages", events: ["message.sent", "message.edited", "message.deleted", "message.reacted"] },
            { cat: "Users", events: ["user.joined", "user.left", "user.updated", "user.blocked"] },
            { cat: "Rooms", events: ["room.created", "room.updated", "room.deleted", "room.archived"] },
            { cat: "Agents", events: ["agent.started", "agent.completed", "agent.failed"] },
            { cat: "System", events: ["webhook.enabled", "webhook.disabled"] },
          ].map((g) => (
            <div key={g.cat} className="rounded-lg border border-border bg-muted/20 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold"><BookOpen className="h-3 w-3" /> {g.cat}</h4>
              <ul className="mt-1.5 space-y-0.5">
                {g.events.map((ev) => <li key={ev} className="text-[11px] font-mono text-muted-foreground">{ev}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </ConsoleShell>
  );
}
