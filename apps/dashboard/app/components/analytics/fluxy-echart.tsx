"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/app/components/theme-provider";
import * as echarts from "echarts/core";
import {
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  RadarChart,
  TreemapChart,
} from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  PolarComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  GaugeChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  PolarComponent,
  GraphicComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
]);

const ORANGE = "#FF6A1A";

export function fluxyChartTheme(isDark: boolean) {
  const muted = isDark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)";
  const line = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const tooltipBg = isDark ? "rgba(30,30,30,0.94)" : "rgba(255,255,255,0.96)";
  const tooltipFg = isDark ? "#f4f4f5" : "#0f172a";
  return { muted, line, tooltipBg, tooltipFg, isDark, orange: ORANGE };
}

export function FluxyEChart({
  option,
  height = 280,
  className,
}: {
  option: EChartsOption;
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option, isDark]);

  useEffect(() => {
    chartRef.current?.resize();
  }, [height]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ height, width: "100%" }}
      role="img"
    />
  );
}

export const FLUXY_CHART_PALETTE = [
  "#FF6A1A",
  "#38bdf8",
  "#f59e0b",
  "#34d399",
  "#a78bfa",
  "#94a3b8",
];
