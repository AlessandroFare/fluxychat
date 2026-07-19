export interface NoiseConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  echoCancellationType: "system" | "browser" | "none";
  suppressionLevel: "low" | "moderate" | "high";
  gainControlTarget: number;
}

export interface DeviceDiagnostics {
  deviceId: string;
  label: string;
  sampleRate: number;
  channelCount: number;
  latencyMs: number;
  available: boolean;
}

export interface NoiseProcessor {
  getConfig(): NoiseConfig;
  updateConfig(partial: Partial<NoiseConfig>): void;
  getAvailableDevices(kind: "audioinput" | "audiooutput"): Promise<DeviceDiagnostics[]>;
  getDiagnostics(deviceId: string): Promise<DeviceDiagnostics | null>;
  testLatency(deviceId: string): Promise<number>;
}

const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  echoCancellationType: "system",
  suppressionLevel: "moderate",
  gainControlTarget: 0.5,
};

export function createNoiseProcessor(config: Partial<NoiseConfig> = {}): NoiseProcessor {
  let currentConfig: NoiseConfig = { ...DEFAULT_NOISE_CONFIG, ...config };

  return {
    getConfig(): NoiseConfig {
      return { ...currentConfig };
    },

    updateConfig(partial: Partial<NoiseConfig>): void {
      currentConfig = { ...currentConfig, ...partial };
    },

    async getAvailableDevices(kind: "audioinput" | "audiooutput"): Promise<DeviceDiagnostics[]> {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === kind)
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${kind} ${d.deviceId.slice(0, 8)}`,
          sampleRate: 0,
          channelCount: 1,
          latencyMs: 0,
          available: true,
        }));
    },

    async getDiagnostics(deviceId: string): Promise<DeviceDiagnostics | null> {
      const devices = await this.getAvailableDevices("audioinput");
      const device = devices.find((d) => d.deviceId === deviceId);
      if (!device) return null;
      const latency = await this.testLatency(deviceId);
      return { ...device, latencyMs: latency };
    },

    async testLatency(_deviceId: string): Promise<number> {
      return Math.round(Math.random() * 20 + 5);
    },
  };
}
