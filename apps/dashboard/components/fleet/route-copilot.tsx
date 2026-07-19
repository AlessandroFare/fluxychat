"use client";

import React, { useEffect, useState } from "react";
import { Bot, Cloud, Gauge, Route, AlertTriangle } from "lucide-react";

interface CopilotData {
  distanceMeters: number; baseDurationMin: number; trafficFactor: number;
  weather: string; weatherFactor: number; estimatedDurationMin: number;
  alternatives: Array<{ label: string; durationMin: number; traffic: string; note: string | null }>;
  advice: string; timestamp: string;
}

interface RouteCopilotPanelProps {
  copilot: CopilotData | null;
  loading: boolean;
}

const weatherEmoji: Record<string, string> = { clear: "☀️", cloudy: "☁️", rain: "🌧️", storm: "⛈️" };

export function RouteCopilotPanel({ copilot, loading }: RouteCopilotPanelProps) {
  if (loading) return <div className="rounded-lg border p-3 text-xs text-muted-foreground animate-pulse">AI Route Copilot analyzing...</div>;
  if (!copilot) return null;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-3 text-xs dark:from-blue-950/30 dark:to-indigo-950/30">
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
        <Bot className="h-4 w-4" /> AI Route Copilot
      </div>

      <div className="mb-2 flex items-center gap-3 text-muted-foreground">
        <span><Cloud className="mr-0.5 inline h-3 w-3" /> {weatherEmoji[copilot.weather] || "☀️"} {copilot.weather}</span>
        <span><Gauge className="mr-0.5 inline h-3 w-3" /> Traffic: {copilot.trafficFactor.toFixed(1)}x</span>
        <span><Route className="mr-0.5 inline h-3 w-3" /> {(copilot.distanceMeters / 1000).toFixed(1)} km</span>
      </div>

      {copilot.alternatives.map((alt) => (
        <div key={alt.label} className="mb-1 flex items-center justify-between rounded bg-white/60 px-2 py-1 dark:bg-gray-800/60">
          <span className="font-medium">{alt.label}</span>
          <span className="text-muted-foreground">{alt.durationMin} min</span>
          <span className="text-muted-foreground">{alt.traffic}</span>
          {alt.note && <span className="flex items-center gap-0.5 text-amber-600"><AlertTriangle className="h-3 w-3" />{alt.note}</span>}
        </div>
      ))}

      <div className="mt-2 rounded bg-indigo-100/60 p-2 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
        <Bot className="mr-1 inline h-3 w-3" /> {copilot.advice}
      </div>
    </div>
  );
}
