export type PipelineStage = "mic" | "asr" | "llm" | "tts" | "speaker" | "multimodal";

import { createTurnDetector, type VadBackend } from "./voice-turn-detection";
import { audioLevelFromPcmBuffer, createSileroVadScorer, DEFAULT_SILERO_ONNX_MODEL_URL, DEFAULT_SILERO_VAD_WASM_URL } from "./silero-vad";

/** unified = one multimodal realtime call; legacy = separate STT → LLM → TTS hops */
export type PipelineMode = "unified" | "legacy";

export type VoiceTransportMode = "realtime" | "chunked" | "text_only";

export interface PipelineMetrics {
  stage: PipelineStage;
  startMs: number;
  endMs: number;
  durationMs: number;
  pipelineMode?: PipelineMode;
}

export interface PipelineEvent {
  type: "stage_start" | "stage_end" | "pipeline_complete" | "pipeline_error" | "transport_fallback" | "vad";
  stage: PipelineStage;
  timestamp: string;
  metrics?: PipelineMetrics;
  error?: string;
  transport?: VoiceTransportMode;
  pipelineMode?: PipelineMode;
  vad?: { event: string; energy?: number; speechProb?: number };
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
  /**
   * `unified` (default): single multimodal session — audio/text in, audio out in one provider call.
   * `legacy`: separate asr → llm → tts stages (higher latency, migration compat).
   */
  pipelineMode?: PipelineMode;
  /** Turn detection for mic endpointing (roadmap #10). */
  vadBackend?: VadBackend;
  sileroWasmUrl?: string;
  /** Silero ONNX model URL (defaults to jsDelivr vad-web artifact). */
  sileroOnnxModelUrl?: string;
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
  getPipelineMode(): PipelineMode;
  onEvent(callback: (event: PipelineEvent) => void): void;
}

export function resolveVoicePipelineStages(
  mode: PipelineMode,
  transport: VoiceTransportMode,
): PipelineStage[] {
  if (mode === "unified") {
    if (transport === "text_only") return ["multimodal", "speaker"];
    return ["mic", "multimodal", "speaker"];
  }
  if (transport === "text_only") return ["llm", "tts", "speaker"];
  return ["mic", "asr", "llm", "tts", "speaker"];
}

export function createVoicePipeline(config: PipelineConfig = {}): VoicePipeline {
  let status: PipelineStatus = "idle";
  const metrics: PipelineMetrics[] = [];
  const listeners = new Set<(event: PipelineEvent) => void>();
  const autoFallback = config.autoFallback !== false;
  const pipelineMode: PipelineMode = config.pipelineMode ?? "unified";

  const modelUrl =
    config.sileroOnnxModelUrl ??
    config.sileroWasmUrl ??
    (DEFAULT_SILERO_VAD_WASM_URL || DEFAULT_SILERO_ONNX_MODEL_URL);

  const silero = createSileroVadScorer({ onnxModelUrl: modelUrl });
  void silero.loadOnnx();
  const turnDetector = createTurnDetector(
    {
      vadBackend: config.vadBackend ?? "hybrid",
      silero: { enabled: true, speechThreshold: 0.5 },
    },
    silero,
  );

  function detectInitialTransport(): VoiceTransportMode {
    if (config.preferredTransport) return config.preferredTransport;
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
      return "realtime";
    }
    return "text_only";
  }

  let activeTransport: VoiceTransportMode = detectInitialTransport();

  function emit(event: PipelineEvent): void {
    for (const listener of listeners) listener({ ...event, pipelineMode });
  }

  function setTransport(next: VoiceTransportMode, reason?: string): void {
    if (activeTransport === next) return;
    activeTransport = next;
    emit({
      type: "transport_fallback",
      stage: pipelineMode === "unified" ? "multimodal" : "mic",
      timestamp: new Date().toISOString(),
      transport: next,
      ...(reason ? { error: reason } : {}),
    });
  }

  function recordMetrics(stage: PipelineStage): PipelineMetrics {
    const existing = metrics.find((m) => m.stage === stage);
    if (existing) return existing;
    const entry: PipelineMetrics = {
      stage,
      startMs: 0,
      endMs: 0,
      durationMs: 0,
      pipelineMode,
    };
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

  async function runForCurrentTransport(): Promise<void> {
    const stages = resolveVoicePipelineStages(pipelineMode, activeTransport);
    await runStages(stages);
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

    async processAudio(audio: ArrayBuffer): Promise<void> {
      if (status !== "running") return;

      const level = audioLevelFromPcmBuffer(audio);
      const speechProbRaw = silero.scorePcmBuffer(audio);
      const speechProb =
        typeof speechProbRaw === "number" ? speechProbRaw : await speechProbRaw;
      const vadEvent = turnDetector.processAudio(level, audio);
      if (vadEvent) {
        emit({
          type: "vad",
          stage: "mic",
          timestamp: vadEvent.timestamp,
          vad: {
            event: vadEvent.type,
            energy: vadEvent.energy ?? level,
            speechProb,
          },
        });
      }

      if (activeTransport === "text_only" && pipelineMode === "legacy") {
        await runForCurrentTransport();
        return;
      }

      if (config.simulateRealtimeFailure && activeTransport !== "text_only") {
        emit({
          type: "pipeline_error",
          stage: pipelineMode === "unified" ? "multimodal" : "mic",
          timestamp: new Date().toISOString(),
          error: "realtime_unavailable",
        });
        if (autoFallback) {
          setTransport("text_only", "realtime_unavailable");
          await runForCurrentTransport();
        } else {
          status = "error";
        }
        return;
      }

      await runForCurrentTransport();
    },

    async processText(_text: string): Promise<void> {
      if (status !== "running") return;
      await runForCurrentTransport();
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

    getPipelineMode(): PipelineMode {
      return pipelineMode;
    },

    onEvent(callback: (event: PipelineEvent) => void): void {
      listeners.add(callback);
    },
  };
}
