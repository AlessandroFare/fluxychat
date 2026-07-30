export type TransportType = "websocket" | "webtransport" | "sse" | "long-poll" | "polling";

export interface TransportHealth {
  transport: TransportType;
  connected: boolean;
  latencyMs: number;
  lastPing: number;
  consecutiveFailures: number;
}

export interface AdaptiveTransportConfig {
  initialTransport?: TransportType;
  failureThreshold?: number;
  cooldownMs?: number;
  pingIntervalMs?: number;
}

export interface AdaptiveTransportApi {
  getCurrentTransport(): TransportType;
  getHealth(): TransportHealth;
  recordSuccess(): void;
  recordFailure(): void;
  getAvailableTransports(): TransportType[];
  forceTransport(type: TransportType): void;
  onFallback(cb: (from: TransportType, to: TransportType) => void): void;
}

export function createAdaptiveTransport(config?: AdaptiveTransportConfig): AdaptiveTransportApi {
  const threshold = config?.failureThreshold ?? 3;
  const cooldownMs = config?.cooldownMs ?? 30_000;
  const transports: TransportType[] = ["webtransport", "websocket", "sse", "long-poll", "polling"];
  // Feature detection: if WebTransport is not available, skip it
  const wtSupported = typeof (globalThis as any)?.WebTransport === "function";
  const effectiveTransports = wtSupported ? transports : transports.filter((t) => t !== "webtransport");
  let currentIdx = effectiveTransports.indexOf(config?.initialTransport ?? "webtransport");
  if (currentIdx < 0) currentIdx = 0;
  let failures = 0;
  let lastFallback = 0;
  const fallbackCbs: Array<(from: TransportType, to: TransportType) => void> = [];

  function health(): TransportHealth {
    return { transport: effectiveTransports[currentIdx], connected: failures < threshold, latencyMs: 0, lastPing: Date.now(), consecutiveFailures: failures };
  }

  return {
    getCurrentTransport() { return effectiveTransports[currentIdx]; },
    getHealth() { return health(); },
    recordSuccess() { failures = 0; },
    recordFailure() {
      failures++;
      if (failures >= threshold && currentIdx < effectiveTransports.length - 1) {
        const now = Date.now();
        if (now - lastFallback > cooldownMs) {
          const from = effectiveTransports[currentIdx];
          currentIdx++;
          failures = 0;
          lastFallback = now;
          for (const cb of fallbackCbs) cb(from, effectiveTransports[currentIdx]);
        }
      }
    },
    getAvailableTransports() { return [...effectiveTransports]; },
    forceTransport(type) {
      const idx = effectiveTransports.indexOf(type);
      if (idx >= 0) { currentIdx = idx; failures = 0; }
    },
    onFallback(cb) { fallbackCbs.push(cb); },
  };
}
