"use client";

import React, { useMemo, useState } from "react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button, Input, Panel, Section } from "../components/ui";
import { formatNumber } from "@/lib/format-number";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { PUBLIC_PLAN_CATALOG } from "../../lib/plan-catalog";

import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const WORKER_URL = getPublicWorkerUrl();

interface PlanInfo {
  projectId: string;
  planName: string;
  billingStatus: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  messageLimitMonthly?: number | null;
  agentInvokeLimitMonthly?: number | null;
  webhookDeliveryLimitMonthly?: number | null;
}

interface UsageData {
  messages_created?: number;
  agent_invokes?: number;
  webhook_deliveries?: number;
}

const PLAN_DETAILS = PUBLIC_PLAN_CATALOG;

function pct(used: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageBarFillColor(percent: number): string {
  return percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-green-500";
}

export default function BillingPage() {
  const { adminJwt, activeProject } = useDashboardSession();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [usage, setUsage] = useState<UsageData>({});
  const [monthKey, setMonthKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  const loadPlan = async () => {
    if (!adminJwt.trim() || !activeProject?.id) {
      setError("JWT and active project required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkerJson<{
        plan: PlanInfo;
        usage?: UsageData;
        monthKey?: string;
        paymentsEnabled?: boolean;
      }>(`${WORKER_URL}/billing/plan`, {
        headers: { Authorization: `Bearer ${adminJwt}`, "X-Project-Id": activeProject.id },
      });
      setPlan(data.plan);
      setUsage(data.usage || {});
      setMonthKey(data.monthKey || "");
      setPaymentsEnabled(Boolean(data.paymentsEnabled));
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load billing info"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName: string) => {
    if (!adminJwt.trim() || !activeProject?.id) return;
    setUpgrading(true);
    setError(null);
    try {
      const data = await fetchWorkerJson<{ url?: string; error?: string }>(
        `${WORKER_URL}/billing/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminJwt}`,
            "X-Project-Id": activeProject.id,
          },
          body: JSON.stringify({
            planName,
            successUrl: `${window.location.origin}/billing?success=1`,
            cancelUrl: `${window.location.origin}/billing?cancelled=1`,
          }),
        }
      );
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (err: unknown) {
      const msg = messageFromUnknown(err, "Checkout failed");
      if (msg === "billing_not_configured") {
        setError(
          "Card checkout is not enabled on this server. Use the Free plan or ask an operator to change your plan in Projects.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handlePortal = async () => {
    if (!adminJwt.trim() || !activeProject?.id) return;
    setPortalLoading(true);
    setError(null);
    try {
      const data = await fetchWorkerJson<{ url?: string; error?: string }>(
        `${WORKER_URL}/billing/portal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminJwt}`,
            "X-Project-Id": activeProject.id,
          },
          body: JSON.stringify({ returnUrl: `${window.location.origin}/billing` }),
        }
      );
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Portal failed");
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to open billing portal"));
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlanDetail = plan ? PLAN_DETAILS[plan.planName] || PLAN_DETAILS.free : PLAN_DETAILS.free;

  return (
    <ConsoleShell className="max-w-3xl lg:max-w-3xl">
      <ConsolePageHeader
        title="Billing & usage"
        description="Plan, monthly usage, and Stripe checkout for the active project."
      />

      {error && (
        <div className="mb-3 rounded-xl border border-red-200/80 bg-red-50 p-3 text-sm text-red-950">{error}</div>
      )}
      {notice && (
        <div className="mb-3 rounded-xl border border-emerald-200/80 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</div>
      )}

      {!plan && !loading && (
        <Section title="Load plan and usage" description="Pull current plan and this month&apos;s counters from the Worker.">
          <Button variant="primary" onClick={loadPlan} disabled={!adminJwt.trim() || !activeProject?.id}>
            Load plan and usage
          </Button>
          {(!adminJwt.trim() || !activeProject?.id) && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                The button stays disabled until both are set in this browser session (
                <code className="text-xs">sessionStorage</code>):
              </p>
              <ul className="mt-2 max-w-xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {!adminJwt.trim() ? (
                  <li>
                    Paste an <strong>admin JWT</strong> (owner or admin) in{" "}
                    <a href="/onboarding" className="text-foreground underline underline-offset-2">
                      /onboarding
                    </a>{" "}
                    step 0. A member JWT alone is not enough for billing.
                  </li>
                ) : null}
                {!activeProject?.id ? (
                  <li>
                    Set an <strong>active project</strong> in{" "}
                    <a href="/onboarding" className="text-foreground underline underline-offset-2">
                      /onboarding
                    </a>{" "}
                    (step 1) or choose &quot;Use in dashboard&quot; under{" "}
                    <a href="/projects" className="text-foreground underline underline-offset-2">
                      /projects
                    </a>
                    .
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </Section>
      )}

      {loading && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
          <div className="mb-4 flex items-center gap-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mb-4">
            <Skeleton className="mb-1 h-3 w-1/3" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
          <div className="mb-4">
            <Skeleton className="mb-1 h-3 w-1/3" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
          <div className="mb-4">
            <Skeleton className="mb-1 h-3 w-1/3" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
        </div>
      )}

      {plan && (
        <>
          <Section
            title="Current Plan"
            description={`Billing status: ${plan.billingStatus}${monthKey ? ` | Usage period: ${monthKey}` : ""}`}
            actions={
              plan.billingStatus === "active" ? (
                <Button onClick={handlePortal} disabled={portalLoading}>
                  {portalLoading ? "Opening..." : "Manage Subscription"}
                </Button>
              ) : undefined
            }
          >
            <div className="mb-4 flex items-center gap-4">
              <div
                className={[
                  "rounded-md px-4 py-2 text-base font-semibold",
                  plan.planName === "free" ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-900",
                ].join(" ")}
              >
                {currentPlanDetail.label}
              </div>
              <div className="text-sm text-muted-foreground">{currentPlanDetail.price}</div>
            </div>

            {plan.billingStatus !== "active" && paymentsEnabled ? (
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Button className="bg-brand text-white shadow-md hover:bg-[#e8614d]" onClick={() => handleUpgrade("starter")} disabled={upgrading}>
                  {upgrading ? "Redirecting..." : "Upgrade to Starter"}
                </Button>
                <Button className="bg-brand text-white shadow-md hover:bg-[#e8614d]" onClick={() => handleUpgrade("pro")} disabled={upgrading}>
                  {upgrading ? "Redirecting..." : "Upgrade to Pro"}
                </Button>
              </div>
            ) : null}
            {plan.billingStatus !== "active" && !paymentsEnabled ? (
              <p className="mt-3 text-sm text-muted-foreground">
                This beta host runs without Stripe. You stay on the Free tier with monthly quotas, or an operator can set
                plan limits under <strong>Projects → Edit plan</strong>.
              </p>
            ) : null}
          </Section>

          <Section title="Monthly Usage">
            <div className="mb-3 text-xs text-muted-foreground">
              Quotas are enforced with <code>402 quota_exceeded</code> when a monthly limit is reached.
              See <code>docs/billing-overage-policy.md</code>.
            </div>
            {[
              {
                label: "Messages",
                used: usage.messages_created || 0,
                limit: plan.messageLimitMonthly || currentPlanDetail.messages,
              },
              {
                label: "Agent Invokes",
                used: usage.agent_invokes || 0,
                limit: plan.agentInvokeLimitMonthly || currentPlanDetail.agents,
              },
              {
                label: "Webhook Deliveries",
                used: usage.webhook_deliveries || 0,
                limit: plan.webhookDeliveryLimitMonthly || currentPlanDetail.webhooks,
              },
            ].map((metric) => {
              const p = pct(metric.used, metric.limit);
              return (
                <div key={metric.label} className="mb-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-foreground">{metric.label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(metric.used)} / {metric.limit === -1 ? "Unlimited" : formatNumber(metric.limit)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                    <div className={`h-full rounded transition-all ${usageBarFillColor(p)}`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </Section>

          <Section title="Plan Comparison">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(PLAN_DETAILS).map(([key, detail]) => (
                <Panel
                  key={key}
                  className={cn(plan.planName === key ? "border-2 border-primary/40 ring-2 ring-primary/15" : "")}
                >
                  <div className="mb-1 font-semibold">{detail.label}</div>
                  <div className="mb-2 text-xl">{detail.price}</div>
                  <div className="text-xs text-muted-foreground">
                    <div>Messages: {detail.messages === -1 ? "Unlimited" : formatNumber(detail.messages)}</div>
                    <div>Agents: {detail.agents === -1 ? "Unlimited" : formatNumber(detail.agents)}</div>
                    <div>Webhooks: {detail.webhooks === -1 ? "Unlimited" : formatNumber(detail.webhooks)}</div>
                  </div>
                  {plan.planName !== key && key !== "free" && plan.billingStatus !== "active" && paymentsEnabled && (
                    <Button
                      className="mt-2 w-full bg-brand text-white shadow-md hover:bg-[#e8614d]"
                      onClick={() => handleUpgrade(key)}
                      disabled={upgrading}
                    >
                      Upgrade
                    </Button>
                  )}
                  {plan.planName === key && (
                    <div className="mt-2 text-center text-xs font-medium text-emerald-700">Current Plan</div>
                  )}
                </Panel>
              ))}
            </div>
          </Section>

          <div style={{ marginTop: 8 }}>
            <Button variant="neutral" onClick={loadPlan}>
              Refresh
            </Button>
          </div>
        </>
      )}
    </ConsoleShell>
  );
}
