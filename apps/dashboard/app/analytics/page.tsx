"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GitBranch, BarChart, Play, ArrowRight, TrendingUp, Search, Activity, Brain, Lightbulb } from "lucide-react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { AnalyticsVisualSections } from "../components/analytics/analytics-visual-sections";
import { StatCard } from "../components/analytics/analytics-charts";
import { RoomPicker } from "../components/room-picker";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Section, Panel } from "../components/ui";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { createJourneyMapping, createConversationAnalytics, secureRandomInt, secureRandomIntInRange } from "@fluxy-chat/sdk";

import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { downloadBlob } from "@/lib/download-blob";
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
  counters?: {
    webhookDeliveriesTotal?: number;
    webhookDeliveriesDelivered?: number;
    webhookDeliveriesFailed?: number;
    requestsTotal?: number;
    requestsError?: number;
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
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "markdown" | "pdf" | "json">("csv");
  // Generation counters for stale-response suppression. The benchmark has its
  // own generation so a slow benchmark response can never overwrite fresh
  // fast-stats state. (Audit P2 fix.)
  const fetchGenRef = useRef(0);
  const benchGenRef = useRef(0);

  // The benchmark runs 200 server-side DB round-trips and is the slowest call
  // on this page. Run it on its own, non-blocking, so the main dashboard does
  // not wait for it.
  const runBenchmark = useCallback(async () => {
    if (!adminJwt.trim()) return;
    setBenchmarkLoading(true);
    const gen = ++benchGenRef.current;
    try {
      const benchmarkJson = await fetchWorkerJson<BenchmarkStats>(`${WORKER_URL}/benchmark`, {
        method: "POST",
        headers: { ...authHeader(adminJwt), "Content-Type": "application/json" },
        body: JSON.stringify({ iterations: 200 }),
      });
      if (gen !== benchGenRef.current) return;
      setBenchmark(benchmarkJson);
    } catch {
      // Benchmark is non-critical; do not surface as a page-level error.
      if (gen === benchGenRef.current) setBenchmark(null);
    } finally {
      if (gen === benchGenRef.current) setBenchmarkLoading(false);
    }
  }, [adminJwt, authHeader]);

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
    // Stale-response guard: if the user changes room while the previous
    // fetch is in flight, ignore the old result. (Audit P2 fix.)
    const gen = ++fetchGenRef.current;
    // Kick off the slow benchmark in parallel but do NOT await it here.
    void runBenchmark();
    try {
      const [roomJson, costJson, kpiJson, sloJson, alertsJson] =
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
        ]);

      if (gen !== fetchGenRef.current) return;
      setRoomStats(roomJson);
      setCosts(costJson);
      setKpis(kpiJson);
      setSlo(sloJson);
      setAlerts(alertsJson);
      setNotice("Analytics refreshed.");
    } catch (err: unknown) {
      if (gen !== fetchGenRef.current) return;
      setError(messageFromUnknown(err, "Failed to load analytics"));
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [readToken, roomId, authHeader, adminJwt, runBenchmark]);

  useEffect(() => {
    if (!readToken || !roomId.trim()) return;
    void fetchStats();
  }, [roomId, readToken, fetchStats]);

  async function exportRoomData(format: "csv" | "markdown" | "pdf" | "json") {
    if (!readToken) return;
    const needsRoom = format !== "csv" && format !== "json";
    if (needsRoom && !roomId.trim()) {
      setError("Select a room for this export format.");
      return;
    }
    try {
      setError(null);
      let url: string;
      let filename: string;
      if (format === "csv") {
        url = `${WORKER_URL}/export/messages.csv?roomId=${encodeURIComponent(roomId)}`;
        filename = `messages-${roomId || "all"}.csv`;
      } else if (format === "json") {
        url = `${WORKER_URL}/export/messages.json?roomId=${encodeURIComponent(roomId)}`;
        filename = `messages-${roomId || "all"}.json`;
      } else if (format === "markdown") {
        url = `${WORKER_URL}/export/rooms/${encodeURIComponent(roomId)}.markdown`;
        filename = `room-${roomId}.md`;
      } else {
        url = `${WORKER_URL}/export/rooms/${encodeURIComponent(roomId)}.pdf`;
        filename = `room-${roomId}.pdf`;
      }
      const res = await fetchWorker(url, { headers: authHeader(readToken) });
      const blob = await res.blob();
      downloadBlob(blob, filename);
      setNotice(`${format.toUpperCase()} export downloaded.`);
    } catch {
      setError(`Failed to export ${format.toUpperCase()}.`);
    }
  }

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
    downloadBlob(blob, `perf-signal-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
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
      <ConsoleFeedback error={error} notice={notice} className="space-y-3" />

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
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={exportFormat}
              onChange={(e) =>
                setExportFormat(e.target.value as "csv" | "markdown" | "pdf" | "json")
              }
              aria-label="Export format"
            >
              <option value="csv">CSV (messages)</option>
              <option value="json">JSON (messages)</option>
              <option value="markdown">Markdown (room)</option>
              <option value="pdf">PDF (room)</option>
            </select>
            <Button
              variant="primary"
              onClick={() => void exportRoomData(exportFormat)}
              disabled={
                !readToken ||
                ((exportFormat === "markdown" || exportFormat === "pdf") && !roomId.trim())
              }
            >
              Export
            </Button>
          </div>
        </div>

        {roomStats ? (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Room" value={roomStats.roomId} hint="Selected channel" />
            <StatCard
              label="Messages"
              value={formatNumber(roomStats.messageCount)}
              hint="Stored in D1"
              accent="success"
            />
            <StatCard label="Active users" value={String(roomStats.activeUsers)} hint="Distinct senders" />
            <StatCard
              label="Webhook delivery"
              value={slo ? `${(slo.sli.webhookSuccessRate * 100).toFixed(1)}%` : "—"}
              hint={slo ? `${slo.counters?.webhookDeliveriesDelivered ?? 0} delivered` : "Load SLO stats"}
            />
            <StatCard
              label="Agent invokes"
              value={costs ? formatNumber(costs.totals.aiRuns) : "—"}
              hint={costs ? `${costs.totals.agentRunsFailed} failed` : "Admin JWT"}
            />
            <StatCard
              label="Request errors"
              value={slo ? `${(slo.sli.requestErrorRate * 100).toFixed(2)}%` : "—"}
              hint={slo?.sloStatus.overallHealthy ? "SLO healthy" : "Check alerts"}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Enter a room id and refresh.</p>
        )}
      </Section>

      {/* Journey Mapping + Conversation Analytics — Interactive */}
      <div className="mt-8">
        <JourneyMappingSection />
      </div>
      <div className="mt-6">
        <ConversationAnalyticsSection />
      </div>

      <AnalyticsVisualSections
        costs={costs}
        slo={slo}
        alerts={alerts}
        kpis={kpis}
        perfChecks={perfSummary?.checks ?? null}
        perfOverallOk={perfSummary?.overallOk ?? null}
        perfLoading={benchmarkLoading}
        perfExportAction={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="neutral"
              onClick={runBenchmark}
              disabled={benchmarkLoading || !adminJwt.trim()}
            >
              {benchmarkLoading ? "Running benchmark..." : "Run benchmark"}
            </Button>
            <Button variant="neutral" onClick={downloadPerfSignalReport} disabled={!benchmark || !slo}>
              Export perf signal JSON
            </Button>
          </div>
        }
      />
    </ConsoleShell>
  );
}

/* ─── Journey Mapping Interactive ─── */

const JOURNEY_CHANNELS = ["web", "mobile", "voice", "bot", "email", "sms", "push"] as const;
const JOURNEY_ACTIONS = ["view", "click", "purchase", "signup", "support", "feedback", "search"] as const;

function JourneyMappingSection() {
  const jm = useMemo(() => createJourneyMapping(), []);
  const [userId, setUserId] = useState("demo-traveler");
  const [paths, setPaths] = useState<Array<{ from: string; to: string; count: number; avgDurationMs: number }>>([]);
  const [steps, setSteps] = useState<Array<{ channel: string; action: string; ts: number }>>([]);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 9)]); }

  function recordRandomStep() {
    const channel = JOURNEY_CHANNELS[secureRandomInt(JOURNEY_CHANNELS.length)];
    const action = JOURNEY_ACTIONS[secureRandomInt(JOURNEY_ACTIONS.length)];
    const step = jm.recordStep(userId, {
      channel,
      action,
      timestamp: Date.now(),
      durationMs: secureRandomIntInRange(200, 1000),
      metadata: {},
    });
    setSteps((p) => [...p, { channel, action, ts: step.timestamp }]);
    setPaths(jm.getPaths(1));
    addLog(`${channel} → ${action}`);
  }

  function simulateJourney(n: number) {
    for (let i = 0; i < n; i++) {
      const channel = JOURNEY_CHANNELS[secureRandomInt(JOURNEY_CHANNELS.length)];
      const action = JOURNEY_ACTIONS[secureRandomInt(JOURNEY_ACTIONS.length)];
      jm.recordStep(`sim-user-${1 + secureRandomInt(5)}`, {
        channel,
        action,
        timestamp: Date.now() + i,
        durationMs: secureRandomIntInRange(100, 1000),
        metadata: {},
      });
    }
    setPaths(jm.getPaths(1));
    addLog(`Simulated ${n} steps across random users`);
  }

  const avgSteps = jm.getAverageStepsPerJourney();
  const channelColors: Record<string, string> = {
    web: "#3b82f6", mobile: "#8b5cf6", voice: "#f59e0b", bot: "#10b981",
    email: "#ef4444", sms: "#06b6d4", push: "#ec4899",
  };

  return (
    <Section title="Customer Journey Mapping" description="Track user touchpoints across channels and visualize transition paths via createJourneyMapping(). Interactive in-memory demo.">
      <div className="flex flex-wrap gap-2 mb-4">
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="max-w-[140px]" />
        <Button size="sm" onClick={recordRandomStep}><Play className="h-3.5 w-3.5 mr-1" /> Record step</Button>
        <Button size="sm" variant="outline" onClick={() => simulateJourney(10)}>Simulate 10 steps</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Path visualization */}
        <Panel className="p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><GitBranch className="h-4 w-4" /> Transition paths</h4>
          {paths.length === 0 ? (
            <p className="text-xs text-muted-foreground">Record some steps to see channel transition paths.</p>
          ) : (
            <div className="space-y-2">
              {paths.sort((a, b) => b.count - a.count).slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ backgroundColor: channelColors[p.from] || "#94a3b8" }}>
                      {p.from}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ backgroundColor: channelColors[p.to] || "#94a3b8" }}>
                      {p.to}
                    </span>
                  </span>
                  <Badge variant="outline" className="text-[9px] ml-auto">{p.count}x</Badge>
                  <span className="text-[10px] text-muted-foreground">{(p.avgDurationMs / 1000).toFixed(1)}s avg</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Steps log */}
        <Panel className="p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Activity className="h-4 w-4" /> Recent steps</h4>
          <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
            <span>Avg steps/journey: <strong>{avgSteps.toFixed(1)}</strong></span>
          </div>
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No steps recorded yet.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {steps.slice(-10).reverse().map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ backgroundColor: channelColors[s.channel] || "#94a3b8" }}>
                    {s.channel}
                  </span>
                  <span className="text-muted-foreground">{s.action}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(s.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-3 max-h-24 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
        {log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </Section>
  );
}

/* ─── Conversation Analytics Interactive ─── */

function ConversationAnalyticsSection() {
  const ca = useMemo(() => createConversationAnalytics(), []);
  const [text, setText] = useState("");
  const [results, setResults] = useState<Array<{
    text: string;
    sentiment: { label: string; score: number; confidence: number };
    intent: { intent: string; confidence: number };
  }>>([]);
  const [topics, setTopics] = useState<Array<{ name: string; count: number }>>([]);
  const [gaps, setGaps] = useState<Array<{ topic: string; frequency: number; unanswered: number }>>([]);
  const [stats, setStats] = useState<ReturnType<typeof ca.getAggregatedStats> | null>(null);

  function handleAnalyze() {
    if (!text.trim()) return;
    const sentiment = ca.analyzeSentiment(text.trim());
    const intent = ca.extractIntent(text.trim());
    setResults((p) => [...p.slice(-14), { text: text.trim(), sentiment, intent }]);
    setText("");
    const msgs = results.map((r) => r.text).concat(text.trim());
    const clusters = ca.clusterTopics(msgs);
    setTopics(clusters.map((c) => ({ name: c.name, count: c.messageCount })));
    setGaps(ca.identifyKnowledgeGaps(msgs.map((t) => ({ text: t, answered: Math.random() > 0.5 }))).map((g) => ({ topic: g.topic, frequency: g.frequency, unanswered: g.unansweredCount })));
    setStats(ca.getAggregatedStats());
  }

  const SENTIMENT_EMOJI: Record<string, string> = { positive: "😊", negative: "😟", neutral: "😐", mixed: "🤔" };
  const SENTIMENT_COLOR: Record<string, string> = { positive: "text-emerald-400", negative: "text-red-400", neutral: "text-slate-400", mixed: "text-amber-400" };

  return (
    <Section title="Conversation Analytics" description="Sentiment, intent detection, topic clustering, and knowledge gap identification via createConversationAnalytics(). In-memory NLP demo.">
      <div className="flex gap-2 mb-4">
        <Input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
          placeholder="Type a message to analyze (e.g. 'this product is amazing!')"
          className="flex-1" />
        <Button size="sm" onClick={handleAnalyze}><Search className="h-3.5 w-3.5 mr-1" /> Analyze</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Messages */}
        <Panel className="p-4 sm:col-span-2">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Activity className="h-4 w-4" /> Analyzed messages ({results.length})</h4>
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">Type messages above to see sentiment and intent analysis.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {results.slice().reverse().map((r, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs">{r.text}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className={SENTIMENT_COLOR[r.sentiment.label]}>
                      {SENTIMENT_EMOJI[r.sentiment.label]} {r.sentiment.label} ({(r.sentiment.confidence * 100).toFixed(0)}%)
                    </span>
                    <span className="text-muted-foreground">· Intent: <strong>{r.intent.intent}</strong> ({(r.intent.confidence * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Sidebar: topics + gaps */}
        <div className="space-y-4">
          {stats && (
            <Panel className="p-4">
              <h4 className="text-sm font-semibold mb-2">Sentiment</h4>
              <div className="flex justify-around">
                {(Object.entries(stats.sentimentDistribution) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <span className={SENTIMENT_COLOR[k]}>{SENTIMENT_EMOJI[k]}</span>
                    <p className="text-xs font-semibold">{v}</p>
                    <p className="text-[9px] text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {topics.length > 0 && (
            <Panel className="p-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Brain className="h-4 w-4" /> Topics</h4>
              <div className="space-y-1">
                {topics.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate">{t.name}</span>
                    <Badge variant="outline" className="text-[9px]">{t.count}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {gaps.length > 0 && (
            <Panel className="p-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Knowledge gaps</h4>
              <div className="space-y-1">
                {gaps.slice(0, 5).map((g, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium">{g.topic}</span>
                    <p className="text-[10px] text-muted-foreground">{g.frequency} mentions · {g.unanswered} unanswered</p>
                    {/* Mini bar */}
                    <div className="mt-0.5 h-1 rounded-full bg-muted/50">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (g.unanswered / Math.max(g.frequency, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Section>
  );
}