import { describe, it, expect } from "vitest";
import { createBotProtection } from "./bot-protection";

describe("bot-protection", () => {
  it("should start with raid mode disabled", () => {
    const bp = createBotProtection();
    expect(bp.isRaidMode()).toBe(false);
  });

  it("should allow requests under rate limit", () => {
    const bp = createBotProtection();
    bp.configureRateLimit({ scope: "user", maxRequests: 5, windowMs: 60000, action: "block" });
    const result = bp.checkRateLimit("user", "user-1");
    expect(result.allowed).toBe(true);
  });

  it("should block requests over rate limit", () => {
    const bp = createBotProtection();
    bp.configureRateLimit({ scope: "device", maxRequests: 2, windowMs: 60000, action: "block" });
    bp.checkRateLimit("device", "dev-1");
    bp.checkRateLimit("device", "dev-1");
    const result = bp.checkRateLimit("device", "dev-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("should return default trust score for unknown", () => {
    const bp = createBotProtection();
    const score = bp.getTrustScore("user-1");
    expect(score.score).toBe(50);
    expect(score.level).toBe("unknown");
  });

  it("should enable raid mode", () => {
    const bp = createBotProtection();
    bp.setRaidMode({ enabled: true, threshold: 100, windowMs: 60000, action: "block_all", autoDisableAfterMs: 300000 });
    expect(bp.isRaidMode()).toBe(true);
  });

  it("should report false positive reviews", () => {
    const bp = createBotProtection();
    const evt = bp.reportFalsePositive("review-1", "admin", "Not a bot");
    expect(evt.type).toBe("false_positive_review");
    expect(bp.getEvents().length).toBeGreaterThan(0);
  });
});
