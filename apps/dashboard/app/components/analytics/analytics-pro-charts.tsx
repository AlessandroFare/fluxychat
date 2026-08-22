"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useTheme } from "@/app/components/theme-provider";
import { FLUXY_CHART_PALETTE, FluxyEChart, fluxyChartTheme } from "./fluxy-echart";

export interface OpsPoint {
  metric_name: string;
  bucket_minute: string;
  metric_value: number;
}

export interface OpsStats {
  windowMinutes: number;
  points: OpsPoint[];
}

function ChartPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function hourKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 13);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

export function pivotOpsHourly(points: OpsPoint[], metric: string): { t: string; v: number }[] {
  const map = new Map<string, number>();
  for (const row of points) {
    if (row.metric_name !== metric) continue;
    const key = hourKey(row.bucket_minute);
    map.set(key, (map.get(key) ?? 0) + Number(row.metric_value || 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, v]) => ({ t, v }));
}

function axisTooltip(theme: ReturnType<typeof fluxyChartTheme>) {
  return {
    trigger: "axis" as const,
    backgroundColor: theme.tooltipBg,
    borderColor: theme.line,
    textStyle: { color: theme.tooltipFg, fontSize: 12 },
  };
}

export function AnalyticsProCharts({
  ops,
  costBreakdown,
  costTotalLabel,
  projected,
  projectedLabels,
  slo,
  usage,
  plan,
}: {
  ops: OpsStats | null;
  costBreakdown: {
    messageCost: number;
    requestCost: number;
    webhookFailureCost: number;
    agentFailureCost: number;
    aiCost: number;
  } | null;
  costTotalLabel: string;
  projected: { for1kMessages: number; for100kMessages: number; for1MMessages: number } | null;
  projectedLabels: { k1: string; k100: string; m1: string };
  slo: {
    sloStatus: { healthScore: number; overallHealthy: boolean };
    sli: { requestErrorRate: number; webhookSuccessRate: number };
  } | null;
  usage: { messagesCreated: number; agentInvokes: number; webhookDeliveries: number } | null;
  plan: {
    messageLimitMonthly: number;
    agentInvokeLimitMonthly: number;
    webhookDeliveryLimitMonthly: number;
  } | null;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = fluxyChartTheme(isDark);
  const points = ops?.points ?? [];

  const trafficOption = useMemo<EChartsOption>(() => {
    const req = pivotOpsHourly(points, "requests_total");
    const err = pivotOpsHourly(points, "requests_error");
    const msg = pivotOpsHourly(points, "messages_created");
    const hours = [...new Set([...req, ...err, ...msg].map((p) => p.t))].sort();
    const lookup = (rows: { t: string; v: number }[]) => {
      const m = new Map(rows.map((r) => [r.t, r.v]));
      return hours.map((h) => m.get(h) ?? 0);
    };
    return {
      color: FLUXY_CHART_PALETTE,
      tooltip: axisTooltip(theme),
      legend: {
        data: ["Requests", "Errors", "Messages"],
        textStyle: { color: theme.muted },
        top: 0,
      },
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: hours.map((h) => h.slice(11)),
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.line } },
        axisLabel: { color: theme.muted, fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: theme.line } },
        axisLabel: { color: theme.muted, fontSize: 10 },
      },
      series: [
        {
          name: "Requests",
          type: "line",
          smooth: true,
          showSymbol: hours.length < 8,
          areaStyle: { opacity: 0.18 },
          lineStyle: { width: 2.5 },
          data: lookup(req),
        },
        {
          name: "Errors",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, type: "dashed" },
          data: lookup(err),
        },
        {
          name: "Messages",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12 },
          data: lookup(msg),
        },
      ],
    };
  }, [points, theme]);

  const costPieOption = useMemo<EChartsOption>(() => {
    const slices = costBreakdown
      ? [
          { name: "Messages", value: costBreakdown.messageCost },
          { name: "Requests", value: costBreakdown.requestCost },
          { name: "Webhooks", value: costBreakdown.webhookFailureCost },
          { name: "Agents", value: costBreakdown.agentFailureCost },
          { name: "AI", value: costBreakdown.aiCost },
        ].filter((s) => s.value > 0)
      : [];
    return {
      color: FLUXY_CHART_PALETTE,
      tooltip: {
        trigger: "item",
        backgroundColor: theme.tooltipBg,
        borderColor: theme.line,
        textStyle: { color: theme.tooltipFg },
        formatter: "{b}: {d}%",
      },
      legend: { bottom: 0, textStyle: { color: theme.muted, fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["48%", "72%"],
          roseType: slices.length > 2 ? "radius" : undefined,
          padAngle: 3,
          itemStyle: { borderRadius: 8, borderColor: isDark ? "#1e1e1e" : "#fff", borderWidth: 2 },
          label: { color: theme.tooltipFg, formatter: "{b}\n{d}%" },
          data: slices,
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "42%",
          style: {
            text: "Total",
            fill: theme.muted,
            fontSize: 10,
            align: "center",
          },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: {
            text: costTotalLabel,
            fill: theme.tooltipFg,
            fontSize: 14,
            fontWeight: 700,
            align: "center",
          },
        },
      ],
    };
  }, [costBreakdown, costTotalLabel, isDark, theme]);

  const radarOption = useMemo<EChartsOption>(() => {
    const health = slo?.sloStatus.healthScore ?? 0;
    const reqOk = slo ? (1 - slo.sli.requestErrorRate) * 100 : 0;
    const hookOk = slo ? slo.sli.webhookSuccessRate * 100 : 0;
    return {
      color: [theme.orange],
      radar: {
        indicator: [
          { name: "Health", max: 100 },
          { name: "Requests", max: 100 },
          { name: "Webhooks", max: 100 },
        ],
        axisName: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.line } },
        splitArea: { areaStyle: { color: isDark ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"] : ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.04)"] } },
      },
      series: [
        {
          type: "radar",
          symbol: "circle",
          symbolSize: 6,
          areaStyle: { opacity: 0.22 },
          lineStyle: { width: 2 },
          data: [{ value: [health, reqOk, hookOk], name: "SLO" }],
        },
      ],
    };
  }, [isDark, slo, theme]);

  const gaugeOption = useMemo<EChartsOption>(() => {
    const value = slo?.sloStatus.healthScore ?? 0;
    return {
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 14, roundCap: true },
          pointer: { show: false },
          axisLine: { lineStyle: { width: 14, color: [[1, isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { offsetCenter: [0, "62%"], color: theme.muted, fontSize: 12 },
          detail: {
            valueAnimation: true,
            fontSize: 28,
            fontWeight: 700,
            color: theme.tooltipFg,
            offsetCenter: [0, "8%"],
            formatter: "{value}",
          },
          itemStyle: { color: theme.orange },
          data: [{ value: Math.round(value), name: "Health" }],
        },
      ],
    };
  }, [isDark, slo, theme]);

  const scaleOption = useMemo<EChartsOption>(() => {
    const vals = projected
      ? [projected.for1kMessages, projected.for100kMessages, projected.for1MMessages]
      : [0, 0, 0];
    return {
      tooltip: axisTooltip(theme),
      grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: [projectedLabels.k1, projectedLabels.k100, projectedLabels.m1],
        axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true },
        axisLine: { lineStyle: { color: theme.line } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: theme.line } },
        axisLabel: { color: theme.muted, fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          barWidth: 28,
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#ff8a47" },
                { offset: 1, color: theme.orange },
              ],
            },
          },
          data: vals,
        },
      ],
    };
  }, [projected, projectedLabels, theme]);

  const treemapOption = useMemo<EChartsOption>(() => {
    const children = costBreakdown
      ? [
          { name: "Messages", value: costBreakdown.messageCost },
          { name: "Requests", value: costBreakdown.requestCost },
          { name: "Webhooks", value: costBreakdown.webhookFailureCost },
          { name: "Agents", value: costBreakdown.agentFailureCost },
          { name: "AI", value: costBreakdown.aiCost },
        ].filter((s) => s.value > 0)
      : [];
    return {
      color: FLUXY_CHART_PALETTE,
      tooltip: {
        trigger: "item",
        backgroundColor: theme.tooltipBg,
        borderColor: theme.line,
        textStyle: { color: theme.tooltipFg },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: { color: "#fff", fontWeight: 600 },
          itemStyle: { borderColor: isDark ? "#1e1e1e" : "#fff", borderWidth: 3, gapWidth: 3 },
          data: children,
        },
      ],
    };
  }, [costBreakdown, isDark, theme]);

  const radialOption = useMemo<EChartsOption>(() => {
    const rows = plan && usage
      ? [
          { name: "Messages", pct: plan.messageLimitMonthly ? Math.min(100, (usage.messagesCreated / plan.messageLimitMonthly) * 100) : 0 },
          { name: "Agents", pct: plan.agentInvokeLimitMonthly ? Math.min(100, (usage.agentInvokes / plan.agentInvokeLimitMonthly) * 100) : 0 },
          { name: "Webhooks", pct: plan.webhookDeliveryLimitMonthly ? Math.min(100, (usage.webhookDeliveries / plan.webhookDeliveryLimitMonthly) * 100) : 0 },
        ]
      : [
          { name: "Messages", pct: 0 },
          { name: "Agents", pct: 0 },
          { name: "Webhooks", pct: 0 },
        ];
    return {
      color: FLUXY_CHART_PALETTE,
      polar: { radius: ["18%", "78%"] },
      angleAxis: { max: 100, startAngle: 90, show: false },
      radiusAxis: {
        type: "category",
        data: rows.map((r) => r.name),
        axisLabel: { color: theme.muted, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      tooltip: {
        trigger: "item",
        backgroundColor: theme.tooltipBg,
        borderColor: theme.line,
        textStyle: { color: theme.tooltipFg },
        formatter: (p: { name?: string; value?: number }) => `${p.name ?? ""}: ${Number(p.value ?? 0).toFixed(1)}%`,
      },
      series: [
        {
          type: "bar",
          coordinateSystem: "polar",
          roundCap: true,
          data: rows.map((r) => r.pct),
          barWidth: 12,
          itemStyle: { borderRadius: 8 },
        },
      ],
    };
  }, [plan, theme, usage]);

  const hasTraffic = points.length > 0;

  return (
    <div className="space-y-4">
      <ChartPanel
        title="Operations over time"
        hint={hasTraffic ? `Hourly buckets from the last ${ops?.windowMinutes ?? 1440} minutes` : "No operational samples yet — charts fill as traffic hits the worker"}
      >
        <FluxyEChart option={trafficOption} height={300} />
      </ChartPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Cost mix" hint="Share of the operator cost model">
          <FluxyEChart option={costPieOption} height={300} />
        </ChartPanel>
        <ChartPanel title="Cost map" hint="Relative spend by source">
          <FluxyEChart option={treemapOption} height={300} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ChartPanel title="Health gauge">
          <FluxyEChart option={gaugeOption} height={240} />
        </ChartPanel>
        <ChartPanel title="Reliability radar" hint="Health, request success, webhook success">
          <FluxyEChart option={radarOption} height={240} />
        </ChartPanel>
        <ChartPanel title="Plan utilization" hint="% of monthly quota used">
          <FluxyEChart option={radialOption} height={240} />
        </ChartPanel>
      </div>

      <ChartPanel title="Volume at scale" hint="Projected operator cost at 1k / 100k / 1M messages">
        <FluxyEChart option={scaleOption} height={260} />
      </ChartPanel>
    </div>
  );
}
