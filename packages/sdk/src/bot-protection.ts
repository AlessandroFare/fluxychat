export type LimitScope = "device" | "user" | "tenant" | "global";
export type TrustLevel = "unknown" | "low" | "medium" | "high";

export interface RateLimitConfig {
  scope: LimitScope;
  maxRequests: number;
  windowMs: number;
  action: "block" | "throttle" | "captcha";
}

export interface RaidModeConfig {
  enabled: boolean;
  threshold: number;
  windowMs: number;
  action: "block_all" | "captcha_all" | "restrict";
  autoDisableAfterMs: number;
}

export interface TrustScore {
  score: number;
  level: TrustLevel;
  signals: string[];
  lastUpdated: string;
}

export interface BotProtectionEvent {
  eventId: string;
  type: "rate_limited" | "raid_detected" | "trust_changed" | "false_positive_review";
  targetId: string;
  details: string;
  timestamp: string;
}

export interface BotProtection {
  configureRateLimit(config: RateLimitConfig): void;
  checkRateLimit(scope: LimitScope, targetId: string): { allowed: boolean; retryAfterMs?: number };
  setRaidMode(config: Partial<RaidModeConfig>): void;
  isRaidMode(): boolean;
  getTrustScore(targetId: string): TrustScore;
  reportFalsePositive(reviewId: string, reviewer: string, notes: string): BotProtectionEvent;
  getEvents(targetId?: string): BotProtectionEvent[];
}

export function createBotProtection(): BotProtection {
  const rateConfigs = new Map<LimitScope, RateLimitConfig>();
  const rateCounters = new Map<string, { count: number; windowStart: number }>();
  let raidConfig: RaidModeConfig = { enabled: false, threshold: 100, windowMs: 60000, action: "block_all", autoDisableAfterMs: 300000 };
  const events: BotProtectionEvent[] = [];
  const trustScores = new Map<string, TrustScore>();

  function getKey(scope: LimitScope, targetId: string): string {
    return `${scope}:${targetId}`;
  }

  return {
    configureRateLimit(config: RateLimitConfig): void {
      rateConfigs.set(config.scope, config);
    },

    checkRateLimit(scope: LimitScope, targetId: string): { allowed: boolean; retryAfterMs?: number } {
      const config = rateConfigs.get(scope);
      if (!config) return { allowed: true };

      const key = getKey(scope, targetId);
      const now = Date.now();
      let entry = rateCounters.get(key);

      if (!entry || now - entry.windowStart > config.windowMs) {
        entry = { count: 1, windowStart: now };
        rateCounters.set(key, entry);
        return { allowed: true };
      }

      entry.count++;
      if (entry.count > config.maxRequests) {
        const retryAfterMs = config.windowMs - (now - entry.windowStart);
        events.push({ eventId: `evt-${events.length + 1}`, type: "rate_limited", targetId, details: `Rate limit exceeded for ${scope}`, timestamp: new Date().toISOString() });
        return { allowed: false, retryAfterMs };
      }

      return { allowed: true };
    },

    setRaidMode(config: Partial<RaidModeConfig>): void {
      raidConfig = { ...raidConfig, ...config };
      if (config.enabled) {
        events.push({ eventId: `evt-${events.length + 1}`, type: "raid_detected", targetId: "system", details: "Raid mode activated", timestamp: new Date().toISOString() });
      }
    },

    isRaidMode(): boolean {
      return raidConfig.enabled;
    },

    getTrustScore(targetId: string): TrustScore {
      const existing = trustScores.get(targetId);
      if (existing) return existing;
      const score: TrustScore = { score: 50, level: "unknown", signals: [], lastUpdated: new Date().toISOString() };
      trustScores.set(targetId, score);
      return score;
    },

    reportFalsePositive(reviewId: string, reviewer: string, notes: string): BotProtectionEvent {
      const evt: BotProtectionEvent = {
        eventId: reviewId,
        type: "false_positive_review",
        targetId: "review",
        details: `Reviewed by ${reviewer}: ${notes}`,
        timestamp: new Date().toISOString(),
      };
      events.push(evt);
      return evt;
    },

    getEvents(targetId?: string) {
      return targetId ? events.filter((e) => e.targetId === targetId) : [...events];
    },
  };
}
