"use client";

import React from "react";
import {
  createVoicePipeline,
  type PipelineConfig,
  type PipelineEvent,
  type PipelineMetrics,
  type PipelineStatus,
  type VoicePipeline,
} from "./voice-pipeline";

export interface UseVoiceOptions extends PipelineConfig {
  /** Report metrics to worker when set */
  onMetrics?: (payload: { totalLatencyMs: number; stages: PipelineMetrics[] }) => void;
}

export interface UseVoiceResult {
  pipeline: VoicePipeline | null;
  status: PipelineStatus;
  latencyMs: number;
  metrics: PipelineMetrics[];
  lastEvent: PipelineEvent | null;
  activeTransport: import("./voice-pipeline").VoiceTransportMode;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  processText: (text: string) => Promise<void>;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceResult {
  const { onMetrics, ...pipelineConfig } = options;
  const onMetricsRef = React.useRef(onMetrics);
  onMetricsRef.current = onMetrics;

  const pipelineRef = React.useRef<VoicePipeline | null>(null);
  if (!pipelineRef.current) {
    pipelineRef.current = createVoicePipeline(pipelineConfig);
  }

  const [status, setStatus] = React.useState<PipelineStatus>("idle");
  const [latencyMs, setLatencyMs] = React.useState(0);
  const [metrics, setMetrics] = React.useState<PipelineMetrics[]>([]);
  const [lastEvent, setLastEvent] = React.useState<PipelineEvent | null>(null);
  const [activeTransport, setActiveTransport] = React.useState(
    () => pipelineRef.current?.getActiveTransport() ?? "text_only",
  );

  React.useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    pipeline.onEvent((event) => {
      setLastEvent(event);
      setStatus(pipeline.getStatus());
      const m = pipeline.getMetrics();
      setMetrics(m);
      setLatencyMs(pipeline.getLatencyMs());
      setActiveTransport(pipeline.getActiveTransport());
      if (event.type === "pipeline_complete" && onMetricsRef.current) {
        onMetricsRef.current({ totalLatencyMs: pipeline.getLatencyMs(), stages: m });
      }
    });
  }, []);

  const start = React.useCallback(async () => {
    await pipelineRef.current?.start();
    setStatus(pipelineRef.current?.getStatus() ?? "idle");
  }, []);

  const stop = React.useCallback(async () => {
    await pipelineRef.current?.stop();
    setStatus(pipelineRef.current?.getStatus() ?? "idle");
  }, []);

  const processText = React.useCallback(async (text: string) => {
    await pipelineRef.current?.processText(text);
    setMetrics(pipelineRef.current?.getMetrics() ?? []);
    setLatencyMs(pipelineRef.current?.getLatencyMs() ?? 0);
    setStatus(pipelineRef.current?.getStatus() ?? "idle");
  }, []);

  return {
    pipeline: pipelineRef.current,
    status,
    latencyMs,
    metrics,
    lastEvent,
    activeTransport,
    start,
    stop,
    processText,
  };
}
