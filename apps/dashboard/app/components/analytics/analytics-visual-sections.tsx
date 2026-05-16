"use client";

import {
  DonutChart,
  HealthGauge,
  HorizontalBarChart,
  StatCard,
  UsageMeter,
} from "./analytics-charts";
import { Section } from "../ui";
import { formatNumber } from "@/lib/format-number";

interface CostStats {
  windowMinutes: number;
  totals: {
    totalMessages: number;
    requestsTotal: number;
    requestsError: number;
    errorRate: number;
    webhookFailed: number;
    agentRunsFailed: number;
    aiRuns: number;
  };
  costBreakdown: {
    messageCost: number;
    requestCost: number;
    webhookFailureCost: number;
    agentFailureCost: number;
    aiCost: number;
    estimatedTotalCost: number;
  };
  projected: { for1kMessages: number; for100kMessages: number; for1MMessages: number };
  pricing?: {
    guardrails: { level: string; code: string; message: string }[];
  };
  plan?: {
    planName: string;
    billingStatus: string;
    messageLimitMonthly: number;
    agentInvokeLimitMonthly: number;
    webhookDeliveryLimitMonthly: number;
  };
  usage?: {
    monthKey: string;
    messagesCreated: number;
    agentInvokes: number;
    webhookDeliveries: number;
  };
  note: string;
}

interface SloStats {
  sloStatus: { overallHealthy: boolean; healthScore: number };
  sli: { requestErrorRate: number; webhookSuccessRate: number };
}

interface AlertsStats {
  openAlerts: number;
  alerts: { id: string; message: string; severity: string }[];
}

interface LaunchKpis {
  activation: {
    completedOnboardingSteps: number;
    totalOnboardingSteps: number;
    activationRate: number;
  };
  retention: { retainedDevelopers: number; activeDaysLast7: number; activeDaysPrev7: number };
  conversion: {
    monthlyMessages: number;
    freeMessagesQuota: number;
    convertedToPaid: boolean;
    estimatedMonthlyRevenue: number;
  };
}

interface PerfSignalCheck {
  label: string;
  expected: string;
  actual: string;
  ok: boolean;
}

interface AnalyticsVisualSectionsProps {
  costs: CostStats | null;
  slo: SloStats | null;
  alerts: AlertsStats | null;
  kpis: LaunchKpis | null;
  perfChecks: PerfSignalCheck[] | null;
  perfOverallOk: boolean | null;
  perfExportAction: React.ReactNode;
}

export function AnalyticsVisualSections({
  costs,
  slo,
  alerts,
  kpis,
  perfChecks,
  perfOverallOk,
  perfExportAction,
}: AnalyticsVisualSectionsProps) {
  return (
    <>
      <Section
        title="Cost estimates"
        description={costs ? `Rolling window: ${costs.windowMinutes} minutes` : undefined}
      >
        {costs ? (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Messages" value={formatNumber(costs.totals.totalMessages)} />
              <StatCard
                label="Requests"
                value={formatNumber(costs.totals.requestsTotal)}
                hint={`${(costs.totals.errorRate * 100).toFixed(2)}% errors`}
                accent={costs.totals.errorRate > 0.05 ? "warning" : "default"}
              />
              <StatCard label="Webhook failures" value={String(costs.totals.webhookFailed)} accent="warning" />
              <StatCard
                label="Est. total"
                value={`GBP ${costs.costBreakdown.estimatedTotalCost.toFixed(2)}`}
                hint="Operator cost model"
                accent="success"
              />
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Cost breakdown</h3>
                <DonutChart
                  centerLabel="Total"
                  centerValue={costs.costBreakdown.estimatedTotalCost.toFixed(2)}
                  segments={[
                    { label: "Messages", value: costs.costBreakdown.messageCost, color: "#e8450a" },
                    { label: "Requests", value: costs.costBreakdown.requestCost, color: "#6366f1" },
                    { label: "Webhooks", value: costs.costBreakdown.webhookFailureCost, color: "#f59e0b" },
                    { label: "Agents", value: costs.costBreakdown.agentFailureCost, color: "#10b981" },
                    { label: "AI", value: costs.costBreakdown.aiCost, color: "#94a3b8" },
                  ].filter((s) => s.value > 0)}
                />
              </div>
              <div className="rounded-xl border border-border bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Volume at scale</h3>
                <HorizontalBarChart
                  items={[
                    {
                      label: "Per 1k msgs",
                      value: costs.projected.for1kMessages,
                      formatted: `GBP ${costs.projected.for1kMessages}`,
                    },
                    {
                      label: "Per 100k msgs",
                      value: costs.projected.for100kMessages,
                      formatted: `GBP ${costs.projected.for100kMessages}`,
                    },
                    {
                      label: "Per 1M msgs",
                      value: costs.projected.for1MMessages,
                      formatted: `GBP ${costs.projected.for1MMessages}`,
                      color: "#e8450a",
                    },
                  ]}
                />
              </div>
            </div>

            {costs.plan && costs.usage ? (
              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <p className="mb-4 text-sm text-muted-foreground">
                  Plan <code className="font-mono text-xs">{costs.plan.planName}</code> - {costs.usage.monthKey}
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <UsageMeter
                    label="Messages"
                    used={costs.usage.messagesCreated}
                    limit={costs.plan.messageLimitMonthly}
                  />
                  <UsageMeter
                    label="Agent invokes"
                    used={costs.usage.agentInvokes}
                    limit={costs.plan.agentInvokeLimitMonthly}
                  />
                  <UsageMeter
                    label="Webhooks"
                    used={costs.usage.webhookDeliveries}
                    limit={costs.plan.webhookDeliveryLimitMonthly}
                  />
                </div>
              </div>
            ) : null}

            {costs.pricing?.guardrails?.length ? (
              <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
                {costs.pricing.guardrails.map((g) => (
                  <li key={g.code} className="text-amber-950">
                    <span className="font-semibold">[{g.level}]</span> {g.message}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-xs text-muted-foreground">{costs.note}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading cost data...</p>
        )}
      </Section>

      <Section title="SLO and alerts">
        {slo ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <HealthGauge
                label="Health score"
                value={slo.sloStatus.healthScore}
                max={100}
                ok={slo.sloStatus.overallHealthy}
              />
              <HealthGauge
                label="Request success"
                value={(1 - slo.sli.requestErrorRate) * 100}
                format={(v) => `${v.toFixed(2)}%`}
                ok={slo.sli.requestErrorRate < 0.01}
              />
              <HealthGauge
                label="Webhook success"
                value={slo.sli.webhookSuccessRate * 100}
                format={(v) => `${v.toFixed(2)}%`}
                ok={slo.sli.webhookSuccessRate > 0.99}
              />
            </div>
            <StatCard
              label="Open alerts"
              value={String(alerts?.openAlerts ?? 0)}
              accent={(alerts?.openAlerts ?? 0) > 0 ? "danger" : "success"}
            />
            {alerts?.alerts?.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-white">
                {alerts.alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="px-4 py-3 text-sm">
                    <span className="font-medium text-foreground">[{alert.severity}]</span>{" "}
                    <span className="text-muted-foreground">{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent alerts.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading SLO data...</p>
        )}
      </Section>

      <Section
        title="Performance signal"
        description="Compared to internal v1 thresholds."
        actions={perfExportAction}
      >
        {perfChecks && perfOverallOk !== null ? (
          <div className="space-y-4">
            <StatCard
              label="Overall"
              value={perfOverallOk ? "PASS" : "CHECK REQUIRED"}
              accent={perfOverallOk ? "success" : "danger"}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {perfChecks.map((c) => (
                <div
                  key={c.label}
                  className={
                    c.ok
                      ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
                      : "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950"
                  }
                >
                  <p className="font-semibold">{c.label}</p>
                  <p className="mt-1 text-xs opacity-80">Expected: {c.expected}</p>
                  <p className="mt-0.5 font-medium">Actual: {c.actual}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Load analytics to compute performance signal.</p>
        )}
      </Section>

      <Section title="Launch KPIs">
        {kpis ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Activation"
                value={`${(kpis.activation.activationRate * 100).toFixed(0)}%`}
                hint={`${kpis.activation.completedOnboardingSteps}/${kpis.activation.totalOnboardingSteps} steps`}
              />
              <StatCard
                label="Retention (7d)"
                value={String(kpis.retention.activeDaysLast7)}
                hint={`vs ${kpis.retention.activeDaysPrev7} prior week`}
              />
              <StatCard
                label="Free quota used"
                value={`${kpis.conversion.monthlyMessages}/${kpis.conversion.freeMessagesQuota}`}
                hint={kpis.conversion.convertedToPaid ? "Converted" : "Free tier"}
              />
            </div>
            <UsageMeter
              label="Onboarding completion"
              used={kpis.activation.completedOnboardingSteps}
              limit={kpis.activation.totalOnboardingSteps}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading launch KPI data...</p>
        )}
      </Section>
    </>
  );
}
