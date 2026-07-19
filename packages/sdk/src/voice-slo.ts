export type SloPhase = "mic" | "asr" | "llm" | "tts" | "speaker";

export interface SloSpan {
  phase: SloPhase;
  startMs: number;
  endMs: number;
  durationMs: number;
  sessionId: string;
  timestamp: string;
}

export interface SloPercentile {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface SloReport {
  phase: SloPhase;
  spans: SloSpan[];
  percentile: SloPercentile;
  count: number;
  meanMs: number;
}

export interface SloTracker {
  addSpan(span: Omit<SloSpan, "timestamp">): void;
  getSpans(phase?: SloPhase): SloSpan[];
  getReport(phase: SloPhase): SloReport;
  getAllReports(): SloReport[];
  getP95Latency(phase: SloPhase): number;
  reset(): void;
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function createSloTracker(): SloTracker {
  const spans: SloSpan[] = [];

  return {
    addSpan(span: Omit<SloSpan, "timestamp">): void {
      spans.push({ ...span, timestamp: new Date().toISOString() });
    },

    getSpans(phase?: SloPhase): SloSpan[] {
      if (!phase) return [...spans];
      return spans.filter((s) => s.phase === phase);
    },

    getReport(phase: SloPhase): SloReport {
      const phaseSpans = spans.filter((s) => s.phase === phase);
      const durations = phaseSpans.map((s) => s.durationMs).sort((a, b) => a - b);
      return {
        phase,
        spans: phaseSpans,
        percentile: {
          p50: computePercentile(durations, 50),
          p90: computePercentile(durations, 90),
          p95: computePercentile(durations, 95),
          p99: computePercentile(durations, 99),
        },
        count: phaseSpans.length,
        meanMs: computeMean(durations),
      };
    },

    getAllReports(): SloReport[] {
      const phases: SloPhase[] = ["mic", "asr", "llm", "tts", "speaker"];
      return phases
        .filter((p) => spans.some((s) => s.phase === p))
        .map((p) => this.getReport(p));
    },

    getP95Latency(phase: SloPhase): number {
      const phaseDurations = spans
        .filter((s) => s.phase === phase)
        .map((s) => s.durationMs)
        .sort((a, b) => a - b);
      return computePercentile(phaseDurations, 95);
    },

    reset(): void {
      spans.length = 0;
    },
  };
}
