export interface QualitySnapshot {
  ttfaMs: number;
  asrWerProxy: number;
  eotDelayMs: number;
  interruptionPrecision: number;
  jitterMs: number;
  packetLoss: number;
  deviceId: string;
  timestamp: string;
}

export interface DeviceBreakdown {
  deviceId: string;
  snapshots: QualitySnapshot[];
  avgJitterMs: number;
  avgPacketLoss: number;
  count: number;
}

export interface QualityReport {
  totalSnapshots: number;
  avgTtfaMs: number;
  avgWerProxy: number;
  avgEotDelayMs: number;
  avgInterruptionPrecision: number;
  avgJitterMs: number;
  avgPacketLoss: number;
  byDevice: DeviceBreakdown[];
}

export interface QualityCollector {
  record(snapshot: Omit<QualitySnapshot, "timestamp">): void;
  getSnapshots(deviceId?: string, limit?: number): QualitySnapshot[];
  getReport(): QualityReport;
  reset(): void;
}

export function createQualityCollector(): QualityCollector {
  const snapshots: QualitySnapshot[] = [];

  return {
    record(snapshot: Omit<QualitySnapshot, "timestamp">): void {
      snapshots.push({ ...snapshot, timestamp: new Date().toISOString() });
    },

    getSnapshots(deviceId?: string, limit?: number): QualitySnapshot[] {
      let filtered = deviceId
        ? snapshots.filter((s) => s.deviceId === deviceId)
        : [...snapshots];
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return limit ? filtered.slice(0, limit) : filtered;
    },

    getReport(): QualityReport {
      if (snapshots.length === 0) {
        return {
          totalSnapshots: 0,
          avgTtfaMs: 0,
          avgWerProxy: 0,
          avgEotDelayMs: 0,
          avgInterruptionPrecision: 0,
          avgJitterMs: 0,
          avgPacketLoss: 0,
          byDevice: [],
        };
      }

      const avg = (key: keyof QualitySnapshot) =>
        snapshots.reduce((sum, s) => sum + (s[key] as number), 0) / snapshots.length;

      const deviceIds = [...new Set(snapshots.map((s) => s.deviceId))];
      const byDevice: DeviceBreakdown[] = deviceIds.map((id) => {
        const devSnapshots = snapshots.filter((s) => s.deviceId === id);
        return {
          deviceId: id,
          snapshots: devSnapshots,
          avgJitterMs: devSnapshots.reduce((s, d) => s + d.jitterMs, 0) / devSnapshots.length,
          avgPacketLoss: devSnapshots.reduce((s, d) => s + d.packetLoss, 0) / devSnapshots.length,
          count: devSnapshots.length,
        };
      });

      return {
        totalSnapshots: snapshots.length,
        avgTtfaMs: avg("ttfaMs"),
        avgWerProxy: avg("asrWerProxy"),
        avgEotDelayMs: avg("eotDelayMs"),
        avgInterruptionPrecision: avg("interruptionPrecision"),
        avgJitterMs: avg("jitterMs"),
        avgPacketLoss: avg("packetLoss"),
        byDevice,
      };
    },

    reset(): void {
      snapshots.length = 0;
    },
  };
}
