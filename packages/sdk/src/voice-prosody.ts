export type ProsodyStyle = "neutral" | "calm" | "energetic" | "sad" | "happy" | "whisper" | "shout";
export type ProsodyRate = "x-slow" | "slow" | "normal" | "fast" | "x-fast";
export type ProsodyPitch = "x-low" | "low" | "normal" | "high" | "x-high";
export type ProsodyProvider = "openai" | "elevenlabs" | "google" | "amazon";

export interface ProsodyConfig {
  style: ProsodyStyle;
  rate: ProsodyRate;
  pitch: ProsodyPitch;
  emphasisWord?: string;
  breakDurationMs?: number;
}

export interface ProsodySafetyBoundary {
  maxRate: ProsodyRate;
  minRate: ProsodyRate;
  maxPitch: ProsodyPitch;
  minPitch: ProsodyPitch;
  allowedStyles: ProsodyStyle[];
}

export interface ProsodyOptions {
  defaultConfig: ProsodyConfig;
  safetyBoundary: ProsodySafetyBoundary;
  providerPriority: ProsodyProvider[];
  fallbackBehavior: "closest" | "error" | "neutral";
}

export interface ProsodyController {
  getConfig(): ProsodyConfig;
  setConfig(config: Partial<ProsodyConfig>): ProsodyConfig;
  resetConfig(): void;
  getSafetyBoundary(): ProsodySafetyBoundary;
  getAvailableProviders(): ProsodyProvider[];
  synthesize(provider: ProsodyProvider, text: string): Promise<ArrayBuffer>;
}

const DEFAULT_PROSODY_CONFIG: ProsodyConfig = {
  style: "neutral",
  rate: "normal",
  pitch: "normal",
};

const DEFAULT_SAFETY_BOUNDARY: ProsodySafetyBoundary = {
  maxRate: "x-fast",
  minRate: "x-slow",
  maxPitch: "x-high",
  minPitch: "x-low",
  allowedStyles: ["neutral", "calm", "energetic", "sad", "happy", "whisper", "shout"],
};

const PROVIDER_STYLE_MAP: Record<ProsodyProvider, ProsodyStyle[]> = {
  openai: ["neutral", "calm", "energetic", "sad", "happy", "whisper", "shout"],
  elevenlabs: ["neutral", "calm", "energetic", "sad", "happy", "whisper", "shout"],
  google: ["neutral", "calm", "energetic", "sad", "happy"],
  amazon: ["neutral", "calm", "energetic", "sad", "happy"],
};

function clampToBoundary(config: ProsodyConfig, boundary: ProsodySafetyBoundary): ProsodyConfig {
  const rateOrder: ProsodyRate[] = ["x-slow", "slow", "normal", "fast", "x-fast"];
  const pitchOrder: ProsodyPitch[] = ["x-low", "low", "normal", "high", "x-high"];

  const clampOrder = <T>(val: T, order: T[], min: T, max: T): T => {
    const idx = order.indexOf(val);
    const minIdx = order.indexOf(min);
    const maxIdx = order.indexOf(max);
    return order[Math.max(minIdx, Math.min(maxIdx, idx))];
  };

  return {
    style: boundary.allowedStyles.includes(config.style) ? config.style : "neutral",
    rate: clampOrder(config.rate, rateOrder, boundary.minRate, boundary.maxRate),
    pitch: clampOrder(config.pitch, pitchOrder, boundary.minPitch, boundary.maxPitch),
  };
}

export function createProsodyController(options: Partial<ProsodyOptions> = {}): ProsodyController {
  const opts: ProsodyOptions = {
    defaultConfig: { ...DEFAULT_PROSODY_CONFIG, ...options.defaultConfig },
    safetyBoundary: { ...DEFAULT_SAFETY_BOUNDARY, ...options.safetyBoundary },
    providerPriority: options.providerPriority ?? ["openai", "elevenlabs", "google", "amazon"],
    fallbackBehavior: options.fallbackBehavior ?? "closest",
  };

  let currentConfig: ProsodyConfig = { ...opts.defaultConfig };

  return {
    getConfig(): ProsodyConfig {
      return { ...currentConfig };
    },

    setConfig(partial: Partial<ProsodyConfig>): ProsodyConfig {
      const merged: ProsodyConfig = { ...currentConfig, ...partial };
      currentConfig = clampToBoundary(merged, opts.safetyBoundary);
      return { ...currentConfig };
    },

    resetConfig(): void {
      currentConfig = { ...opts.defaultConfig };
    },

    getSafetyBoundary(): ProsodySafetyBoundary {
      return { ...opts.safetyBoundary };
    },

    getAvailableProviders(): ProsodyProvider[] {
      return opts.providerPriority;
    },

    async synthesize(_provider: ProsodyProvider, _text: string): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  };
}
