import { describe, expect, it } from "vitest";
import {
  computeTemplateBadge,
  AUDIT_BADGE_EXPIRY_DAYS,
  UNMAINTAINED_AUDIT_STALE_DAYS,
} from "./template-marketplace.js";

describe("template-marketplace", () => {
  const now = Date.UTC(2026, 7, 13);

  it("returns Unverified when never audited", () => {
    expect(computeTemplateBadge({ now }).badge).toBe("Unverified");
  });

  it("returns Verified for fresh audit", () => {
    const lastAuditedAt = now - 7 * 86400 * 1000;
    expect(
      computeTemplateBadge({ lastAuditedAt, now }).badge,
    ).toBe("Verified");
  });

  it("returns AuditExpired when audit is too old", () => {
    const lastAuditedAt = now - (AUDIT_BADGE_EXPIRY_DAYS + 1) * 86400 * 1000;
    expect(
      computeTemplateBadge({ lastAuditedAt, now }).badge,
    ).toBe("AuditExpired");
  });

  it("returns Unmaintained when commit is stale vs audit", () => {
    const lastAuditedAt = now - 30 * 86400 * 1000;
    const lastCommitAt = new Date(
      lastAuditedAt + (UNMAINTAINED_AUDIT_STALE_DAYS + 5) * 86400 * 1000,
    ).toISOString();
    expect(
      computeTemplateBadge({ lastAuditedAt, lastCommitAt, now }).badge,
    ).toBe("Unmaintained");
  });
});
