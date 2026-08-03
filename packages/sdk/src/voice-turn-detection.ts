import { createSemanticEOTDetector, type EOTDetector, type EOTDecision } from "./voice-realtime";

export interface VadConfig {
  energyThreshold: number;
  silenceTimeoutMs: number;
  minSpeechDurationMs: number;
  minSilenceDurationMs: number;
  debounceMs: number;
}

export interface VadEvent {
  type: "speech_start" | "speech_end" | "utterance" | "false_cut";
  timestamp: string;
  energy?: number;
  durationMs?: number;
}

export type VadBackend = "energy" | "silero" | "hybrid";

export interface SileroVadScorer {
  /** Probability of speech in [0, 1] for the current frame (legacy RMS path). */
  scoreSpeech(audioLevel: number): number | Promise<number>;
  /** Frame-accurate score from PCM Int16 mono buffer (production path). */
  scorePcmBuffer?(audio: ArrayBuffer): number | Promise<number>;
  readonly mode?: string;
}

export interface TurnDetectionConfig {
  vad: VadConfig;
  vadBackend?: VadBackend;
  silero?: {
    enabled: boolean;
    speechThreshold: number;
  };
  semantic: {
    enabled: boolean;
    minConfidence: number;
  };
  dynamicEndpointing: {
    enabled: boolean;
    minSilenceMs: number;
    maxSilenceMs: number;
    adaptationRate: number;
  };
}

export interface TurnDetector {
  processAudio(audioLevel: number, pcmBuffer?: ArrayBuffer): VadEvent | null;
  processTranscript(transcript: string): EOTDecision;
  getConfig(): TurnDetectionConfig;
  updateConfig(partial: Partial<TurnDetectionConfig>): void;
  getFalseCutRate(): number;
  reset(): void;
}

const DEFAULT_TURN_CONFIG: TurnDetectionConfig = {
  vad: {
    energyThreshold: 0.02,
    silenceTimeoutMs: 1500,
    minSpeechDurationMs: 100,
    minSilenceDurationMs: 300,
    debounceMs: 200,
  },
  vadBackend: "hybrid",
  silero: {
    enabled: true,
    speechThreshold: 0.5,
  },
  semantic: {
    enabled: true,
    minConfidence: 0.6,
  },
  dynamicEndpointing: {
    enabled: true,
    minSilenceMs: 500,
    maxSilenceMs: 3000,
    adaptationRate: 0.1,
  },
};

function isSpeechLevel(
  cfg: TurnDetectionConfig,
  audioLevel: number,
  silero?: SileroVadScorer | null,
  pcmBuffer?: ArrayBuffer,
): boolean {
  const energySpeech = audioLevel > cfg.vad.energyThreshold;
  const backend = cfg.vadBackend ?? "energy";

  if (backend === "energy" || !cfg.silero?.enabled || !silero) {
    return energySpeech;
  }

  let score: number;
  if (pcmBuffer && silero.scorePcmBuffer) {
    const raw = silero.scorePcmBuffer(pcmBuffer);
    score = typeof raw === "number" ? raw : energySpeech ? 1 : 0;
  } else {
    const raw = silero.scoreSpeech(audioLevel);
    score = typeof raw === "number" ? raw : energySpeech ? 1 : 0;
  }

  const sileroSpeech = score >= (cfg.silero.speechThreshold ?? 0.5);

  if (backend === "silero") {
    return sileroSpeech;
  }

  return energySpeech || sileroSpeech;
}

export function createTurnDetector(
  config: Partial<TurnDetectionConfig> = {},
  silero?: SileroVadScorer | null,
): TurnDetector {
  const cfg: TurnDetectionConfig = {
    vad: { ...DEFAULT_TURN_CONFIG.vad, ...config.vad },
    vadBackend: config.vadBackend ?? DEFAULT_TURN_CONFIG.vadBackend,
    silero: { ...DEFAULT_TURN_CONFIG.silero!, ...config.silero },
    semantic: { ...DEFAULT_TURN_CONFIG.semantic, ...config.semantic },
    dynamicEndpointing: { ...DEFAULT_TURN_CONFIG.dynamicEndpointing, ...config.dynamicEndpointing },
  };

  let isSpeaking = false;
  let speechStartTime = 0;
  let silenceStartTime = 0;
  let totalDecisions = 0;
  let falseCuts = 0;
  let endpointSilenceMs = cfg.dynamicEndpointing.minSilenceMs;

  const semanticEot = createSemanticEOTDetector();

  return {
    processAudio(audioLevel: number, pcmBuffer?: ArrayBuffer): VadEvent | null {
      const now = Date.now();

      if (isSpeechLevel(cfg, audioLevel, silero, pcmBuffer)) {
        if (!isSpeaking) {
          isSpeaking = true;
          speechStartTime = now;
          silenceStartTime = 0;
          return { type: "speech_start", timestamp: new Date().toISOString(), energy: audioLevel };
        }
        silenceStartTime = 0;
        return null;
      }

      if (isSpeaking) {
        if (silenceStartTime === 0) {
          silenceStartTime = now;
        }

        const speechDuration = now - speechStartTime;
        const silenceDuration = now - silenceStartTime;

        if (speechDuration < cfg.vad.minSpeechDurationMs) {
          isSpeaking = false;
          silenceStartTime = 0;
          falseCuts++;
          return { type: "false_cut", timestamp: new Date().toISOString(), durationMs: speechDuration };
        }

        if (silenceDuration >= endpointSilenceMs) {
          isSpeaking = false;
          const dur = now - speechStartTime;
          silenceStartTime = 0;
          return { type: "utterance", timestamp: new Date().toISOString(), durationMs: dur };
        }

        if (silenceDuration >= cfg.vad.minSilenceDurationMs && silenceDuration < endpointSilenceMs) {
          return { type: "speech_end", timestamp: new Date().toISOString() };
        }
      }

      return null;
    },

    processTranscript(transcript: string): EOTDecision {
      totalDecisions++;
      const decision = semanticEot.analyze(transcript);
      if (decision === "turn_complete" || decision === "awaiting_input") {
        if (cfg.semantic.enabled && cfg.dynamicEndpointing.enabled) {
          endpointSilenceMs = Math.max(
            cfg.dynamicEndpointing.minSilenceMs,
            endpointSilenceMs * (1 - cfg.dynamicEndpointing.adaptationRate)
          );
        }
      } else if (decision === "continue" && cfg.dynamicEndpointing.enabled) {
        endpointSilenceMs = Math.min(
          cfg.dynamicEndpointing.maxSilenceMs,
          endpointSilenceMs * (1 + cfg.dynamicEndpointing.adaptationRate)
        );
      }
      return decision;
    },

    getConfig(): TurnDetectionConfig {
      return {
        vad: { ...cfg.vad },
        semantic: { ...cfg.semantic },
        dynamicEndpointing: { ...cfg.dynamicEndpointing },
      };
    },

    updateConfig(partial: Partial<TurnDetectionConfig>): void {
      if (partial.vad) Object.assign(cfg.vad, partial.vad);
      if (partial.semantic) Object.assign(cfg.semantic, partial.semantic);
      if (partial.dynamicEndpointing) Object.assign(cfg.dynamicEndpointing, partial.dynamicEndpointing);
    },

    getFalseCutRate(): number {
      if (totalDecisions === 0) return 0;
      return falseCuts / totalDecisions;
    },

    reset(): void {
      isSpeaking = false;
      speechStartTime = 0;
      silenceStartTime = 0;
      totalDecisions = 0;
      falseCuts = 0;
      endpointSilenceMs = cfg.dynamicEndpointing.minSilenceMs;
      semanticEot.reset();
    },
  };
}
