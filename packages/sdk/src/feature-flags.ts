export type FlagStatus = "enabled" | "disabled" | "holdout";

export interface FeatureFlag {
  flagId: string;
  name: string;
  description: string;
  status: FlagStatus;
  rolloutPercent: number;
  tenantIds: string[];
  killSwitch: boolean;
  metricGuardrails: MetricGuardrail[];
  createdAt: string;
  updatedAt: string;
}

export interface MetricGuardrail {
  metricName: string;
  threshold: number;
  operator: "lt" | "gt" | "lte" | "gte";
  cooldownMs: number;
  lastTriggeredAt?: string;
}

export interface FlagEvaluation {
  flagId: string;
  name: string;
  enabled: boolean;
  reason: string;
  evaluatedAt: string;
}

export interface FeatureFlagManager {
  createFlag(flag: Omit<FeatureFlag, "createdAt" | "updatedAt">): FeatureFlag;
  updateFlag(flagId: string, updates: Partial<FeatureFlag>): FeatureFlag;
  getFlag(flagId: string): FeatureFlag | null;
  deleteFlag(flagId: string): void;
  listFlags(): FeatureFlag[];
  isEnabled(flagId: string, tenantId: string): FlagEvaluation;
  setKillSwitch(flagId: string, active: boolean): void;
  recordMetric(flagId: string, metricName: string, value: number): void;
}

export function createFeatureFlagManager(): FeatureFlagManager {
  const flags = new Map<string, FeatureFlag>();

  return {
    createFlag(flag: Omit<FeatureFlag, "createdAt" | "updatedAt">): FeatureFlag {
      const full: FeatureFlag = {
        ...flag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      flags.set(flag.flagId, full);
      return full;
    },

    updateFlag(flagId: string, updates: Partial<FeatureFlag>): FeatureFlag {
      const existing = flags.get(flagId);
      if (!existing) throw new Error(`Flag ${flagId} not found.`);
      const updated: FeatureFlag = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      flags.set(flagId, updated);
      return updated;
    },

    getFlag(flagId: string) { return flags.get(flagId) ?? null; },

    deleteFlag(flagId: string): void {
      flags.delete(flagId);
    },

    listFlags() { return [...flags.values()]; },

    isEnabled(flagId: string, tenantId: string): FlagEvaluation {
      const flag = flags.get(flagId);
      if (!flag) return { flagId, name: "unknown", enabled: false, reason: "Flag not found", evaluatedAt: new Date().toISOString() };
      if (flag.killSwitch) return { flagId, name: flag.name, enabled: false, reason: "Kill switch active", evaluatedAt: new Date().toISOString() };
      if (flag.status === "holdout") return { flagId, name: flag.name, enabled: false, reason: "Holdout group", evaluatedAt: new Date().toISOString() };
      if (flag.status === "disabled") return { flagId, name: flag.name, enabled: false, reason: "Disabled", evaluatedAt: new Date().toISOString() };
      if (flag.tenantIds.length > 0 && !flag.tenantIds.includes(tenantId)) return { flagId, name: flag.name, enabled: false, reason: "Tenant not in allowlist", evaluatedAt: new Date().toISOString() };

      const hash = (flagId + tenantId).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
      if (hash > flag.rolloutPercent) return { flagId, name: flag.name, enabled: false, reason: "Rollout percent not met", evaluatedAt: new Date().toISOString() };

      return { flagId, name: flag.name, enabled: true, reason: "Active", evaluatedAt: new Date().toISOString() };
    },

    setKillSwitch(flagId: string, active: boolean): void {
      const flag = flags.get(flagId);
      if (!flag) throw new Error(`Flag ${flagId} not found.`);
      flag.killSwitch = active;
      flag.updatedAt = new Date().toISOString();
    },

    recordMetric(flagId: string, metricName: string, value: number): void {
      const flag = flags.get(flagId);
      if (!flag) return;
      for (const guardrail of flag.metricGuardrails) {
        if (guardrail.metricName !== metricName) continue;
        const breached = guardrail.operator === "gt" ? value > guardrail.threshold
          : guardrail.operator === "gte" ? value >= guardrail.threshold
          : guardrail.operator === "lt" ? value < guardrail.threshold
          : value <= guardrail.threshold;
        if (breached) {
          flag.killSwitch = true;
          guardrail.lastTriggeredAt = new Date().toISOString();
          flag.updatedAt = new Date().toISOString();
        }
      }
    },
  };
}
