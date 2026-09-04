"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatNumber } from "@/lib/format-number";
import { messageFromUnknown } from "@/lib/error-message";
import { getTenantUsage, type TenantUsageSnapshot } from "@/lib/tenant-usage-client";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function UsageStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-card shadow-[var(--shadow-2)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function pct(used: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function TenantUsageSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TenantUsageSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await getTenantUsage(token);
      setUsage(res.usage);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load tenant usage"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Usage & cost"
        description="Message volume, MAU, attachment storage, and indicative monthly cost for the active project."
        icon={BarChart3}
      />
      <ConsoleFeedback error={error} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading usage…
        </div>
      ) : usage ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Month {usage.monthKey}</span>
            {usage.plan ? (
              <Badge variant="secondary">
                {usage.plan.planName} · {usage.plan.billingStatus}
              </Badge>
            ) : null}
            <Link href="/billing" className="text-primary underline-offset-4 hover:underline">
              Open billing & quotas →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UsageStat
              label="Messages (month)"
              value={formatNumber(usage.monthlyUsage.messagesCreated)}
              hint={
                usage.plan?.messageLimitMonthly
                  ? `${pct(usage.monthlyUsage.messagesCreated, usage.plan.messageLimitMonthly)}% of ${formatNumber(usage.plan.messageLimitMonthly)} quota`
                  : undefined
              }
            />
            <UsageStat
              label="Agent invokes (month)"
              value={formatNumber(usage.monthlyUsage.agentInvokes)}
              hint={
                usage.plan?.agentInvokeLimitMonthly
                  ? `${pct(usage.monthlyUsage.agentInvokes, usage.plan.agentInvokeLimitMonthly)}% of quota`
                  : undefined
              }
            />
            <UsageStat label="MAU" value={formatNumber(usage.totals.mau)} hint="Distinct senders this month" />
            <UsageStat
              label="Storage"
              value={formatBytes(usage.totals.storageBytes)}
              hint={`${formatNumber(usage.totals.attachmentFiles)} attachment files`}
            />
          </div>

          <Panel>
            <Section title="All-time totals" description="Aggregate counters across the project.">
              <div className="grid gap-3 sm:grid-cols-3">
                <UsageStat label="Messages" value={formatNumber(usage.totals.messagesAllTime)} />
                <UsageStat label="Rooms" value={formatNumber(usage.totals.rooms)} />
                <UsageStat label="Webhooks (month)" value={formatNumber(usage.monthlyUsage.webhookDeliveries)} />
              </div>
            </Section>
          </Panel>

          <Panel>
            <Section
              title="Estimated cost"
              description={usage.costEstimate.disclaimer}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-semibold tabular-nums">
                  ${usage.costEstimate.estimatedUsd.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">{usage.costEstimate.currency} · indicative</span>
              </div>
              <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                <li>${usage.costEstimate.rates.perThousandMessagesUsd}/1k messages</li>
                <li>${usage.costEstimate.rates.perAgentInvokeUsd}/agent invoke</li>
                <li>${usage.costEstimate.rates.perGbStorageMonthUsd}/GB storage / month</li>
              </ul>
            </Section>
          </Panel>

          {Object.keys(usage.opsLast30d).length > 0 ? (
            <Panel>
              <Section title="Operational metrics (30d)" description="From operational_metrics rollups.">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(usage.opsLast30d)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([metric, total]) => (
                      <div key={metric} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{metric}</span>
                        <span className="tabular-nums">{formatNumber(total)}</span>
                      </div>
                    ))}
                </div>
              </Section>
            </Panel>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Paste an admin JWT on Projects to load usage.</p>
      )}
    </ConsoleShell>
  );
}
