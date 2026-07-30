export type PipelineStage = "mic" | "asr" | "llm" | "tts" | "speaker";

export type VoiceTransportMode = "realtime" | "chunked" | "text_only";

export interface PipelineMetrics {
  stage: PipelineStage;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface PipelineEvent {
  type: "stage_start" | "stage_end" | "pipeline_complete" | "pipeline_error" | "transport_fallback";
  stage: PipelineStage;
  timestamp: string;
  metrics?: PipelineMetrics;
  error?: string;
  transport?: VoiceTransportMode;
}

export type PipelineStatus = "idle" | "running" | "paused" | "error" | "complete";

export interface PipelineConfig {
  sampleRate?: number;
  bufferSize?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  /** Preferred path: OpenAI Realtime WS, chunked REST STT/TTS, or text-only. */
  preferredTransport?: VoiceTransportMode;
  /** Degrade when realtime/chunked fails (default true). */
  autoFallback?: boolean;
  /** Force realtime failure for tests. */
  simulateRealtimeFailure?: boolean;
}

export interface VoicePipeline {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  processAudio(audio: ArrayBuffer): Promise<void>;
  processText(text: string): Promise<void>;
  getMetrics(): PipelineMetrics[];
  getStatus(): PipelineStatus;
  getLatencyMs(): number;
  getActiveTransport(): VoiceTransportMode;
  onEvent(callback: (event: PipelineEvent) => void): void;
}

export function createVoicePipeline(config: PipelineConfig = {}): VoicePipeline {
  let status: PipelineStatus = "idle";
  const metrics: PipelineMetrics[] = [];
  const listeners = new Set<(event: PipelineEvent) => void>();
  const autoFallback = config.autoFallback !== false;

  function detectInitialTransport(): VoiceTransportMode {
    if (config.preferredTransport) return config.preferredTransport;
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
      return "realtime";
    }
    return "text_only";
  }

  let activeTransport: VoiceTransportMode = detectInitialTransport();

  const realtimeStages: PipelineStage[] = ["mic", "asr", "llm", "tts", "speaker"];
  const textStages: PipelineStage[] = ["llm", "tts", "speaker"];

  function emit(event: PipelineEvent): void {
    for (const listener of listeners) listener(event);
  }

  function setTransport(next: VoiceTransportMode, reason?: string): void {
    if (activeTransport === next) return;
    activeTransport = next;
    emit({
      type: "transport_fallback",
      stage: "mic",
      timestamp: new Date().toISOString(),
      transport: next,
      ...(reason ? { error: reason } : {}),
    });
  }

  function recordMetrics(stage: PipelineStage): PipelineMetrics {
    const existing = metrics.find((m) => m.stage === stage);
    if (existing) return existing;
    const entry: PipelineMetrics = { stage, startMs: 0, endMs: 0, durationMs: 0 };
    metrics.push(entry);
    return entry;
  }

  async function runStages(stageList: PipelineStage[]): Promise<void> {
    for (const stage of stageList) {
      const m = recordMetrics(stage);
      m.startMs = Date.now();
      emit({ type: "stage_start", stage, timestamp: new Date().toISOString() });
      m.endMs = Date.now();
      m.durationMs = m.endMs - m.startMs;
      emit({ type: "stage_end", stage, timestamp: new Date().toISOString(), metrics: m });
    }
    emit({ type: "pipeline_complete", stage: "speaker", timestamp: new Date().toISOString() });
  }

  return {
    async start(): Promise<void> {
      status = "running";
      activeTransport = detectInitialTransport();
    },

    async stop(): Promise<void> {
      status = "idle";
    },

    async pause(): Promise<void> {
      if (status === "running") status = "paused";
    },

    async resume(): Promise<void> {
      if (status === "paused") status = "running";
    },

    async processAudio(_audio: ArrayBuffer): Promise<void> {
      if (status !== "running") return;

      if (activeTransport === "text_only") {
        await runStages(textStages);
        return;
      }

      if (config.simulateRealtimeFailure) {
        emit({
          type: "pipeline_error",
          stage: "mic",
          timestamp: new Date().toISOString(),
          error: "realtime_unavailable",
        });
        if (autoFallback) {
          setTransport("text_only", "realtime_unavailable");
          await runStages(textStages);
        } else {
          status = "error";
        }
        return;
      }

      await runStages(activeTransport === "chunked" ? realtimeStages : realtimeStages);
    },

    async processText(_text: string): Promise<void> {
      if (status !== "running") return;
      await runStages(textStages);
    },

    getMetrics(): PipelineMetrics[] {
      return [...metrics];
    },

    getStatus(): PipelineStatus {
      return status;
    },

    getLatencyMs(): number {
      return metrics.reduce((sum, m) => sum + m.durationMs, 0);
    },

    getActiveTransport(): VoiceTransportMode {
      return activeTransport;
    },

    onEvent(callback: (event: PipelineEvent) => void): void {
      listeners.add(callback);
    },
  };
}
