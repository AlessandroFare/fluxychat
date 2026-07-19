export type PipelineStage = "mic" | "asr" | "llm" | "tts" | "speaker";

export interface PipelineMetrics {
  stage: PipelineStage;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface PipelineEvent {
  type: "stage_start" | "stage_end" | "pipeline_complete" | "pipeline_error";
  stage: PipelineStage;
  timestamp: string;
  metrics?: PipelineMetrics;
  error?: string;
}

export type PipelineStatus = "idle" | "running" | "paused" | "error" | "complete";

export interface PipelineConfig {
  sampleRate?: number;
  bufferSize?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
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
  onEvent(callback: (event: PipelineEvent) => void): void;
}

export function createVoicePipeline(config: PipelineConfig = {}): VoicePipeline {
  let status: PipelineStatus = "idle";
  const metrics: PipelineMetrics[] = [];
  const listeners = new Set<(event: PipelineEvent) => void>();

  const stages: PipelineStage[] = ["mic", "asr", "llm", "tts", "speaker"];

  function emit(event: PipelineEvent): void {
    for (const listener of listeners) listener(event);
  }

  function recordMetrics(stage: PipelineStage): PipelineMetrics {
    const existing = metrics.find((m) => m.stage === stage);
    if (existing) return existing;
    const entry: PipelineMetrics = { stage, startMs: 0, endMs: 0, durationMs: 0 };
    metrics.push(entry);
    return entry;
  }

  return {
    async start(): Promise<void> {
      status = "running";
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
      const now = Date.now();
      for (const stage of stages) {
        const m = recordMetrics(stage);
        m.startMs = now;
        emit({ type: "stage_start", stage, timestamp: new Date().toISOString() });
        m.endMs = Date.now();
        m.durationMs = m.endMs - m.startMs;
        emit({ type: "stage_end", stage, timestamp: new Date().toISOString(), metrics: m });
      }
      emit({ type: "pipeline_complete", stage: "speaker", timestamp: new Date().toISOString() });
    },

    async processText(_text: string): Promise<void> {
      if (status !== "running") return;
      for (const stage of ["llm" as PipelineStage, "tts" as PipelineStage, "speaker" as PipelineStage]) {
        const m = recordMetrics(stage);
        m.startMs = Date.now();
        emit({ type: "stage_start", stage, timestamp: new Date().toISOString() });
        m.endMs = Date.now();
        m.durationMs = m.endMs - m.startMs;
        emit({ type: "stage_end", stage, timestamp: new Date().toISOString(), metrics: m });
      }
      emit({ type: "pipeline_complete", stage: "speaker", timestamp: new Date().toISOString() });
    },

    getMetrics(): PipelineMetrics[] {
      return [...metrics];
    },

    getStatus(): PipelineStatus {
      return status;
    },

    getLatencyMs(): number {
      const total = metrics.reduce((sum, m) => sum + m.durationMs, 0);
      return total;
    },

    onEvent(callback: (event: PipelineEvent) => void): void {
      listeners.add(callback);
    },
  };
}
