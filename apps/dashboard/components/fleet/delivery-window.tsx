"use client";

import React from "react";
import { Clock, TrendingUp, Sparkles } from "lucide-react";

interface WindowData {
  distanceKm: number; estimatedMinutes: number;
  windowLowMinutes: number; windowHighMinutes: number;
  windowLow: string; windowHigh: string;
  confidencePercent: number; sampleSize: number;
  factors: { peakHour: boolean; averageSpeedKmph: number };
}

interface DeliveryWindowProps {
  data: WindowData | null;
  loading: boolean;
}

function confidenceColor(pct: number) {
  if (pct >= 90) return "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400";
  if (pct >= 80) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400";
  return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400";
}

export function DeliveryWindow({ data, loading }: DeliveryWindowProps) {
  if (loading) return <div className="rounded-lg border p-3 text-xs text-muted-foreground animate-pulse">Predicting delivery window...</div>;
  if (!data) return null;

  const low = new Date(data.windowLow);
  const high = new Date(data.windowHigh);

  return (
    <div className="rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50 p-3 text-xs dark:from-emerald-950/30 dark:to-teal-950/30">
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
        <Sparkles className="h-4 w-4" /> Predictive Delivery Window
      </div>

      <div className="mb-2 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="font-mono text-lg font-bold">{low.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="text-muted-foreground">to</div>
          <div className="font-mono text-lg font-bold">{high.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-center gap-1">
        <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${data.confidencePercent}%` }} />
        </div>
        <span className={confidenceColor(data.confidencePercent)}>
          {data.confidencePercent}% confidence
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-muted-foreground">
        <span><Clock className="mr-0.5 inline h-3 w-3" /> Est. {data.estimatedMinutes} min</span>
        <span><TrendingUp className="mr-0.5 inline h-3 w-3" /> Avg {data.factors.averageSpeedKmph} km/h</span>
        {data.factors.peakHour && <span className="text-amber-600">Peak hour</span>}
        <span className="opacity-60">{data.sampleSize} samples</span>
      </div>
    </div>
  );
}
