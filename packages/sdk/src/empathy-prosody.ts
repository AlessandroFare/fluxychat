/**
 * #46 Empathy Layer — client-side prosody feature extraction + rule classifier.
 * Never surfaces inferred emotional state to the end user.
 */

export type EmpathyInferredState = "calm" | "frustrated" | "stressed" | "neutral";

export interface ProsodyFeatures {
  pitchVariance: number;
  speechRate: number;
  pauseRatio: number;
  sampleCount: number;
}

export interface ProsodySignal {
  roomId: string;
  userId: string;
  turnId: string;
  pitchVariance: number;
  speechRate: number;
  pauseRatio: number;
  inferredState: EmpathyInferredState;
  confidence: number;
  capturedAt: string;
}

export interface EmpathyProsodySample {
  /** Normalized audio energy 0–1 */
  energy: number;
  /** Milliseconds since previous sample */
  deltaMs: number;
}

export interface EmpathyProsodyController {
  ingest(sample: EmpathyProsodySample): ProsodySignal | null;
  reset(turnId?: string): void;
  getLastSignal(): ProsodySignal | null;
}

const MIN_SAMPLES = 6;
const MIN_CONFIDENCE = 0.55;

function classify(features: ProsodyFeatures): { state: EmpathyInferredState; confidence: number } {
  const { pitchVariance, speechRate, pauseRatio, sampleCount } = features;
  const coverage = Math.min(1, sampleCount / 20);

  if (pitchVariance > 0.35 && speechRate > 0.65) {
    return { state: "stressed", confidence: Math.min(0.95, 0.5 + pitchVariance * 0.4 + coverage * 0.2) };
  }
  if (speechRate > 0.7 && pauseRatio < 0.25) {
    return { state: "frustrated", confidence: Math.min(0.9, 0.45 + speechRate * 0.35 + coverage * 0.2) };
  }
  if (pitchVariance < 0.15 && speechRate < 0.45 && pauseRatio > 0.35) {
    return { state: "calm", confidence: Math.min(0.85, 0.4 + (1 - speechRate) * 0.3 + coverage * 0.15) };
  }
  return { state: "neutral", confidence: Math.min(0.75, 0.35 + coverage * 0.25) };
}

export function createEmpathyProsodyController(input: {
  roomId: string;
  userId: string;
  turnId?: string;
  minConfidence?: number;
}): EmpathyProsodyController {
  let turnId = input.turnId ?? `turn_${Date.now()}`;
  let energies: number[] = [];
  let speechMs = 0;
  let pauseMs = 0;
  let lastSignal: ProsodySignal | null = null;
  const minConfidence = input.minConfidence ?? MIN_CONFIDENCE;

  function buildFeatures(): ProsodyFeatures {
    const sampleCount = energies.length;
    if (sampleCount === 0) {
      return { pitchVariance: 0, speechRate: 0, pauseRatio: 0.5, sampleCount: 0 };
    }
    const mean = energies.reduce((a, b) => a + b, 0) / sampleCount;
    const variance =
      energies.reduce((acc, e) => acc + (e - mean) ** 2, 0) / Math.max(1, sampleCount - 1);
    const pitchVariance = Math.min(1, Math.sqrt(variance) * 2);
    const totalMs = speechMs + pauseMs || 1;
    const speechRate = Math.min(1, speechMs / totalMs);
    const pauseRatio = Math.min(1, pauseMs / totalMs);
    return { pitchVariance, speechRate, pauseRatio, sampleCount };
  }

  return {
    ingest(sample: EmpathyProsodySample): ProsodySignal | null {
      const speaking = sample.energy > 0.08;
      if (speaking) {
        speechMs += sample.deltaMs;
        energies.push(sample.energy);
      } else {
        pauseMs += sample.deltaMs;
      }

      const features = buildFeatures();
      if (features.sampleCount < MIN_SAMPLES) return null;

      const { state, confidence } = classify(features);
      if (confidence < minConfidence) return null;

      lastSignal = {
        roomId: input.roomId,
        userId: input.userId,
        turnId,
        pitchVariance: Math.round(features.pitchVariance * 1000) / 1000,
        speechRate: Math.round(features.speechRate * 1000) / 1000,
        pauseRatio: Math.round(features.pauseRatio * 1000) / 1000,
        inferredState: state,
        confidence: Math.round(confidence * 1000) / 1000,
        capturedAt: new Date().toISOString(),
      };
      return lastSignal;
    },

    reset(nextTurnId?: string): void {
      turnId = nextTurnId ?? `turn_${Date.now()}`;
      energies = [];
      speechMs = 0;
      pauseMs = 0;
      lastSignal = null;
    },

    getLastSignal(): ProsodySignal | null {
      return lastSignal;
    },
  };
}

export function buildEmpathyAgentPromptSuffix(state: EmpathyInferredState): string {
  switch (state) {
    case "frustrated":
      return (
        "Adapt silently: the user may be frustrated. Be concise, acknowledge difficulty without mentioning emotions, " +
        "and offer a clear next step or human escalation option."
      );
    case "stressed":
      return (
        "Adapt silently: the user may be under pressure. Use a calm tone, shorter sentences, and avoid piling on questions. " +
        "Make human escalation easy to find."
      );
    case "calm":
      return "Adapt silently: conversational pace is calm — match their pace; stay clear and supportive.";
    default:
      return "";
  }
}
