import { describe, expect, it } from "vitest";
import { scoreMessageNotification } from "./notification-priority.js";

describe("notification-priority", () => {
  it("boosts mentions and urgent keywords", () => {
    const mention = scoreMessageNotification({ isMention: true, preview: "hey @you" });
    expect(mention.level).toBe("high");
    expect(mention.reasons).toContain("mention");

    const urgent = scoreMessageNotification({ isMention: false, preview: "Site is down ASAP" });
    expect(urgent.score).toBeGreaterThanOrEqual(10);
    expect(urgent.reasons).toContain("urgency_keyword");

    const urgentWithRole = scoreMessageNotification({
      isMention: false,
      preview: "Site is down ASAP",
      authorRole: "admin",
    });
    expect(urgentWithRole.level).toBe("high");
  });

  it("boosts announcement topic above plain messages", () => {
    const announcement = scoreMessageNotification({
      isMention: false,
      preview: "Maintenance tonight",
      topic: "announcement",
    });
    expect(announcement.score).toBe(10);
    expect(announcement.reasons).toContain("announcement");

    const elevatedAnnouncement = scoreMessageNotification({
      isMention: false,
      preview: "Maintenance tonight",
      topic: "announcement",
      authorRole: "admin",
    });
    expect(elevatedAnnouncement.level).toBe("high");
  });

  it("marks plain messages as low/normal", () => {
    const plain = scoreMessageNotification({ isMention: false, preview: "ok thanks" });
    expect(plain.score).toBeLessThan(12);
    expect(plain.shouldBatchLowPriority).toBe(true);
  });
});
