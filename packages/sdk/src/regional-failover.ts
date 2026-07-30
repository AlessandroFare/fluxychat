export interface RegionConfig {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  latencyMs?: number;
}

export interface FailoverState {
  currentRegion: string;
  availableRegions: RegionConfig[];
  failoverCount: number;
  lastFailoverAt?: string;
}

export interface RegionalFailoverApi {
  getState(): FailoverState;
  addRegion(config: RegionConfig): void;
  removeRegion(id: string): void;
  failover(): string | null;
  setLatency(regionId: string, latencyMs: number): void;
  getOptimalRegion(): string;
  reset(): void;
  onFailover(cb: (from: string, to: string) => void): void;
}

export function createRegionalFailover(): RegionalFailoverApi {
  const regions: RegionConfig[] = [];
  let currentIdx = 0;
  let failoverCount = 0;
  let lastFailoverAt: string | undefined;
  const cbs: Array<(from: string, to: string) => void> = [];

  return {
    getState() {
      return { currentRegion: regions[currentIdx]?.id ?? "", availableRegions: [...regions], failoverCount, lastFailoverAt };
    },
    addRegion(config) { regions.push(config); regions.sort((a, b) => a.priority - b.priority); },
    removeRegion(id) {
      const idx = regions.findIndex((r) => r.id === id);
      if (idx >= 0) regions.splice(idx, 1);
      if (currentIdx >= regions.length) currentIdx = Math.max(0, regions.length - 1);
    },
    failover() {
      if (currentIdx < regions.length - 1) {
        const from = regions[currentIdx].id;
        currentIdx++;
        failoverCount++;
        lastFailoverAt = new Date().toISOString();
        for (const cb of cbs) cb(from, regions[currentIdx].id);
        return regions[currentIdx].id;
      }
      return null;
    },
    setLatency(regionId, latencyMs) {
      const r = regions.find((r) => r.id === regionId);
      if (r) r.latencyMs = latencyMs;
    },
    getOptimalRegion() {
      let best = regions[0];
      for (const r of regions) {
        if (r.active && (r.latencyMs ?? Infinity) < (best.latencyMs ?? Infinity)) best = r;
      }
      return best?.id ?? "";
    },
    reset() { currentIdx = 0; failoverCount = 0; lastFailoverAt = undefined; },
    onFailover(cb) { cbs.push(cb); },
  };
}
