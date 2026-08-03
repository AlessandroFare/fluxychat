import type { SileroVadScorer } from "./voice-turn-detection";

/** Silero ONNX model (same artifact as @ricky0123/vad-web). Host yourself for air-gapped deploys. */
export const DEFAULT_SILERO_ONNX_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/silero_vad.onnx";

/** Legacy alias — dashboard may set NEXT_PUBLIC_SILERO_VAD_WASM_URL to ONNX model URL. */
export const DEFAULT_SILERO_VAD_WASM_URL =
  typeof process !== "undefined"
    ? String(process.env.NEXT_PUBLIC_SILERO_VAD_WASM_URL ?? "").trim()
    : "";

export type SileroVadMode = "onnx" | "frame" | "energy";

export interface SileroVadOptions {
  /** ONNX model URL (Silero VAD). Falls back to frame VAD when load fails. */
  onnxModelUrl?: string;
  /** @deprecated Use onnxModelUrl — kept for voice pipeline compat. */
  wasmUrl?: string;
  energyGain?: number;
  sampleRate?: number;
}

export interface SileroVadInstance extends SileroVadScorer {
  readonly mode: SileroVadMode;
  scorePcmBuffer(audio: ArrayBuffer): number | Promise<number>;
  loadOnnx(): Promise<boolean>;
  /** @deprecated Use loadOnnx */
  loadWasm(): Promise<boolean>;
}

const FRAME_SAMPLES = 512;

interface FrameVadState {
  noiseFloor: number;
}

function computeZeroCrossingRate(view: Int16Array): number {
  let crossings = 0;
  for (let i = 1; i < view.length; i++) {
    const prev = view[i - 1];
    const cur = view[i];
    if ((cur >= 0 && prev < 0) || (cur < 0 && prev >= 0)) crossings++;
  }
  return crossings / Math.max(1, view.length - 1);
}

/** Production frame VAD: adaptive noise floor + SNR + ZCR (Silero-compatible scoring API). */
export function scorePcmFrame(view: Int16Array, state: FrameVadState): number {
  if (!view.length) return 0;

  let sum = 0;
  for (let i = 0; i < view.length; i++) {
    const n = view[i] / 32768;
    sum += n * n;
  }
  const energy = Math.sqrt(sum / view.length);
  const zcr = computeZeroCrossingRate(view);

  if (energy < state.noiseFloor * 1.8) {
    state.noiseFloor = state.noiseFloor * 0.92 + energy * 0.08;
  }

  const snr = energy / Math.max(state.noiseFloor, 0.0001);
  const energyScore = 1 / (1 + Math.exp(-4 * (snr - 2.2)));
  const zcrScore = zcr > 0.02 && zcr < 0.32 ? 1 : 0.25;

  return Math.min(1, Math.max(0, energyScore * 0.78 + zcrScore * 0.22));
}

function energyToSpeechProb(audioLevel: number, gain: number): number {
  const x = Math.max(0, Math.min(1, audioLevel * gain));
  return 1 / (1 + Math.exp(-6 * (x - 0.35)));
}

type OnnxSession = {
  run: (feeds: Record<string, unknown>) => Promise<{ output?: { data: Float32Array } }>;
};

async function tryLoadOnnxRuntime(): Promise<{ InferenceSession: { create: (url: string) => Promise<OnnxSession> } } | null> {
  if (typeof globalThis.fetch !== "function") return null;
  try {
    const mod = await import(
      /* webpackIgnore: true */
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.mjs"
    );
    return mod as { InferenceSession: { create: (url: string) => Promise<OnnxSession> } };
  } catch {
    return null;
  }
}

/**
 * Silero-compatible VAD scorer.
 * Priority: ONNX Silero → frame VAD → RMS energy fallback.
 */
export function createSileroVadScorer(options: SileroVadOptions = {}): SileroVadInstance {
  const gain = options.energyGain ?? 12;
  const resolvedModelUrl = (
    options.onnxModelUrl ??
    options.wasmUrl ??
    DEFAULT_SILERO_VAD_WASM_URL ??
    DEFAULT_SILERO_ONNX_MODEL_URL
  ).trim();

  const frameState: FrameVadState = { noiseFloor: 0.008 };
  let mode: SileroVadMode = "frame";
  let onnxSession: OnnxSession | null = null;
  let lastFrameScore = 0;

  function scoreFromPcm(audio: ArrayBuffer): number {
    const view = new Int16Array(audio);
    if (!view.length) return 0;

    if (onnxSession) {
      const slice = view.length >= FRAME_SAMPLES ? view.subarray(0, FRAME_SAMPLES) : view;
      const floats = new Float32Array(FRAME_SAMPLES);
      for (let i = 0; i < slice.length; i++) floats[i] = slice[i] / 32768;
      void onnxSession
        .run({ input: floats })
        .then((out) => {
          const prob = out?.output?.data?.[0];
          if (typeof prob === "number" && Number.isFinite(prob)) lastFrameScore = prob;
        })
        .catch(() => {});
      return lastFrameScore || scorePcmFrame(slice, frameState);
    }

    const frame =
      view.length >= FRAME_SAMPLES ? view.subarray(view.length - FRAME_SAMPLES) : view;
    lastFrameScore = scorePcmFrame(frame, frameState);
    return lastFrameScore;
  }

  return {
    get mode() {
      return mode;
    },

    scoreSpeech(audioLevel: number): number {
      if (lastFrameScore > 0) return lastFrameScore;
      return energyToSpeechProb(audioLevel, gain);
    },

    scorePcmBuffer(audio: ArrayBuffer): number {
      const score = scoreFromPcm(audio);
      if (mode === "energy") {
        return energyToSpeechProb(audioLevelFromPcmBuffer(audio), gain);
      }
      return score;
    },

    async loadOnnx(): Promise<boolean> {
      if (!resolvedModelUrl || typeof globalThis.fetch !== "function") {
        mode = "frame";
        return false;
      }

      const ort = await tryLoadOnnxRuntime();
      if (!ort?.InferenceSession?.create) {
        mode = "frame";
        return false;
      }

      try {
        onnxSession = await ort.InferenceSession.create(resolvedModelUrl);
        mode = "onnx";
        return true;
      } catch {
        mode = "frame";
        onnxSession = null;
        return false;
      }
    },

    async loadWasm(): Promise<boolean> {
      return this.loadOnnx();
    },
  };
}

export function audioLevelFromPcmBuffer(audio: ArrayBuffer): number {
  if (!audio.byteLength) return 0;
  const view = new Int16Array(audio);
  if (!view.length) return 0;
  let sum = 0;
  for (let i = 0; i < view.length; i++) {
    const n = view[i] / 32768;
    sum += n * n;
  }
  return Math.sqrt(sum / view.length);
}
