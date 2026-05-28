"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { AnalyticsVisualSections } from "../components/analytics/analytics-visual-sections";
import { StatCard } from "../components/analytics/analytics-charts";
import { RoomPicker } from "../components/room-picker";
import { Banner, Button, Section } from "../components/ui";

import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { formatNumber } from "@/lib/format-number";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorker, fetchWorkerJson } from "@/lib/worker-fetch";

const WORKER_URL = getPublicWorkerUrl();

interface RoomStats {
  roomId: string;
  messageCount: number;
  activeUsers: number;
}

interface CostStats {
  projectId: string;
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
  projected: {
    for1kMessages: number;
    for100kMessages: number;
    for1MMessages: number;
  };
  assumptions: {
    costMessagesPerMillion: number;
    costRequestsPerMillion: number;
    costWebhookFailureUnit: number;
    costAgentFailedRunUnit: number;
  };
  pricing?: {
    projectedMonthlyRevenue: number;
    grossProfit: number;
    grossMargin: number;
    minGrossMargin: number;
    pricePerMillionMessages: number;
    pricePerAgentInvoke: number;
    pricePerWebhookDelivery: number;
    recommendedMinPricePerMillionMessages: number | null;
    guardrails: { level: string; code: string; message: string }[];
  };
  plan?: {
    planName: string;
    billingStatus: string;
    messageLimitMonthly: number;
    agentInvokeLimitMonthly: number;
    webhookDeliveryLimitMonthly: number;
    pricingVersion: string;
  };
  usage?: {
    monthKey: string;
    messagesCreated: number;
    agentInvokes: number;
    webhookDeliveries: number;
  };
  note: string;
}

interface LaunchKpis {
  projectId: string;
  generatedAt: string;
  activation: {
    completedOnboardingSteps: number;
    totalOnboardingSteps: number;
    activationRate: number;
    checks: Record<string, boolean>;
  };
  retention: {
    activeDaysLast7: number;
    activeDaysPrev7: number;
    retainedDevelopers: number;
    trend: number;
  };
  conversion: {
    monthlyMessages: number;
    monthlyAgentInvokes: number;
    freeMessagesQuota: number;
    estimatedMonthlyRevenue: number;
    convertedToPaid: boolean;
  };
}

interface SloStats {
  sloStatus: {
    overallHealthy: boolean;
    healthScore: number;
  };
  sli: {
    requestErrorRate: number;
    webhookSuccessRate: number;
  };
}

interface AlertsStats {
  openAlerts: number;
  alerts: { id: string; message: string; severity: string; created_at: string }[];
}

interface BenchmarkStats {
  benchmark?: {
    iterations: number;
    totalTimeMs: string | number;
    dbAvgMs: string | number;
    kvAvgMs: string | number | null;
    rps: number;
  };
  capacity?: {
    dbP95Ms: string | number;
    estimatedMaxRPS: number;
  };
}

interface PerfThresholds {
  successRateMinPct: number;
  throughputMinMsgPerSec: number;
  latencyP95MaxMs: number;
  latencyAvgMaxMs: number;
  failureCountMax: number;
}

const PERF_THRESHOLDS_V1: PerfThresholds = {
  successRateMinPct: 99,
  throughputMinMsgPerSec: 20,
  latencyP95MaxMs: 1200,
  latencyAvgMaxMs: 500,
  failureCountMax: 0,
};

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

interface PerfSignalCheck {
  label: string;
  expected: string;
  actual: string;
  ok: boolean;
}

function buildPerfSignalSummary(input: {
  slo: SloStats;
  benchmark: BenchmarkStats;
  openAlerts: number;
}): { overallOk: boolean; checks: PerfSignalCheck[] } {
  const successRatePct = (1 - toNumber(input.slo.sli.requestErrorRate)) * 100;
  const throughput = toNumber(input.benchmark.benchmark?.rps);
  const latencyP95 = toNumber(input.benchmark.capacity?.dbP95Ms);
  const latencyAvg = toNumber(input.benchmark.benchmark?.dbAvgMs);
  const failureCount = input.openAlerts;
  const checks: PerfSignalCheck[] = [
    {
      label: "Success rate",
      expected: `>= ${PERF_THRESHOLDS_V1.successRateMinPct}%`,
      actual: `${successRatePct.toFixed(2)}%`,
      ok: successRatePct >= PERF_THRESHOLDS_V1.successRateMinPct,
    },
    {
      label: "Throughput",
      expected: `>= ${PERF_THRESHOLDS_V1.throughputMinMsgPerSec} rps`,
      actual: `${throughput.toFixed(2)} rps`,
      ok: throughput >= PERF_THRESHOLDS_V1.throughputMinMsgPerSec,
    },
    {
      label: "DB p95",
      expected: `<= ${PERF_THRESHOLDS_V1.latencyP95MaxMs} ms`,
      actual: `${latencyP95.toFixed(2)} ms`,
      ok: latencyP95 <= PERF_THRESHOLDS_V1.latencyP95MaxMs,
    },
    {
      label: "DB avg",
      expected: `<= ${PERF_THRESHOLDS_V1.latencyAvgMaxMs} ms`,
      actual: `${latencyAvg.toFixed(2)} ms`,
      ok: latencyAvg <= PERF_THRESHOLDS_V1.latencyAvgMaxMs,
    },
    {
      label: "Open alerts",
      expected: `<= ${PERF_THRESHOLDS_V1.failureCountMax}`,
      actual: `${failureCount}`,
      ok: failureCount <= PERF_THRESHOLDS_V1.failureCountMax,
    },
  ];
  return { overallOk: checks.every((c) => c.ok), checks };
}

export default function AnalyticsPage() {
  const { adminJwt, memberJwt, activeProject, authHeader } = useDashboardSession();
  const readToken = memberJwt.trim() || adminJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [costs, setCosts] = useState<CostStats | null>(null);
  const [kpis, setKpis] = useState<LaunchKpis | null>(null);
  const [slo, setSlo] = useState<SloStats | null>(null);
  const [alerts, setAlerts] = useState<AlertsStats | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!readToken) {
      setError("Select a session first from Projects or Onboarding.");
      return;
    }
    if (!roomId.trim()) {
      setError("Select a room first.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [roomJson, costJson, kpiJson, sloJson, alertsJson, benchmarkJson] =
        await Promise.all([
          fetchWorkerJson<RoomStats>(
            `${WORKER_URL}/stats/rooms/${encodeURIComponent(roomId)}`,
            { headers: authHeader(readToken) }
          ),
          fetchWorkerJson<CostStats>(`${WORKER_URL}/stats/costs`, {
            headers: authHeader(adminJwt),
          }),
          fetchWorkerJson<LaunchKpis>(`${WORKER_URL}/stats/launch-kpis`, {
            headers: authHeader(adminJwt),
          }),
          fetchWorkerJson<SloStats>(`${WORKER_URL}/stats/slo`, {
            headers: authHeader(adminJwt),
          }),
          fetchWorkerJson<AlertsStats>(`${WORKER_URL}/stats/alerts?limit=10`, {
            headers: authHeader(adminJwt),
          }),
          fetchWorkerJson<BenchmarkStats>(`${WORKER_URL}/benchmark`, {
            method: "POST",
            headers: {
              ...authHeader(adminJwt),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ iterations: 200 }),
          }),
        ]);

      setRoomStats(roomJson);
      setCosts(costJson);
      setKpis(kpiJson);
      setSlo(sloJson);
      setAlerts(alertsJson);
      setBenchmark(benchmarkJson);
      setNotice("Analytics refreshed.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load analytics"));
    } finally {
      setLoading(false);
    }
  }, [readToken, roomId, authHeader, adminJwt]);

  useEffect(() => {
    if (!readToken || !roomId.trim()) return;
    void fetchStats();
  }, [roomId, readToken, fetchStats]);

  const downloadPerfSignalReport = () => {
    if (!benchmark || !slo) return;
    const openAlerts = alerts?.openAlerts || 0;
    const summary = buildPerfSignalSummary({ benchmark, slo, openAlerts });
    const payload = {
      generatedAt: new Date().toISOString(),
      projectName: activeProject?.name || null,
      roomId,
      thresholds: PERF_THRESHOLDS_V1,
      overallOk: summary.overallOk,
      checks: summary.checks,
      benchmark,
      slo,
      openAlerts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perf-signal-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Performance signal report downloaded.");
  };

  const perfSummary =
    benchmark && slo
      ? buildPerfSignalSummary({ benchmark, slo, openAlerts: alerts?.openAlerts || 0 })
      : null;

  return (
    <ConsoleShell className="max-w-6xl lg:max-w-6xl">
      <ConsolePageHeader
        title="Analytics & costs"
        description={
          <>
            Room stats and cost estimates from D1. Project:{" "}
            <code>{activeProject?.name || "none selected"}</code>
          </>
        }
      />
      {error ? <Banner variant="error">Error: {error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}

      <Section
        title="Room overview"
        actions={
          <Button onClick={fetchStats} disabled={loading || !readToken || !roomId.trim()}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <RoomPicker token={readToken} value={roomId} onChange={setRoomId} placeholder="Select room" />
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const res = await fetchWorker(
                    `${WORKER_URL}/export/messages.csv?roomId=${encodeURIComponent(roomId)}`,
                    { headers: authHeader(readToken) }
                  );
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `messages-${roomId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setNotice("CSV export downloaded.");
                } catch {
                  setError("Failed to export CSV.");
                }
              }}
              disabled={!readToken}
            >
              Export CSV
            </Button>
            <Button
              variant="neutral"
              onClick={async () => {
                try {
                  const res = await fetchWorker(
                    `${WORKER_URL}/export/messages.json?roomId=${encodeURIComponent(roomId)}`,
                    { headers: authHeader(readToken) }
                  );
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `messages-${roomId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setNotice("JSON export downloaded.");
                } catch {
                  setError("Failed to export JSON.");
                }
              }}
              disabled={!readToken}
            >
              Export JSON
            </Button>
          </div>
        </div>

        {roomStats ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Room" value={roomStats.roomId} hint="Selected channel" />
            <StatCard
              label="Messages"
              value={formatNumber(roomStats.messageCount)}
              hint="Stored in D1"
              accent="success"
            />
            <StatCard label="Active users" value={String(roomStats.activeUsers)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Enter a room id and refresh.</p>
        )}
      </Section>

      <AnalyticsVisualSections
        costs={costs}
        slo={slo}
        alerts={alerts}
        kpis={kpis}
        perfChecks={perfSummary?.checks ?? null}
        perfOverallOk={perfSummary?.overallOk ?? null}
        perfExportAction={
          <Button variant="neutral" onClick={downloadPerfSignalReport} disabled={!benchmark || !slo}>
            Export perf signal JSON
          </Button>
        }
      />
    </ConsoleShell>
  );
}




