import { describe, expect, it } from "vitest";
import { scoreMessageNotification } from "./notification-priority.js";

describe("notification-priority", () => {
  it("boosts mentions and urgent keywords", () => {
    const mention = scoreMessageNotification({ isMention: true, preview: "hey @you" });
    expect(mention.level).toBe("high");
    expect(mention.reasons).toContain("mention");

    const urgent = scoreMessageNotification({ isMention: false, preview: "Site is down ASAP" });
    expect(urgent.level).toBe("high");
    expect(urgent.reasons).toContain("urgency_keyword");
  });

  it("marks plain messages as low/normal", () => {
    const plain = scoreMessageNotification({ isMention: false, preview: "ok thanks" });
    expect(plain.score).toBeLessThan(12);
    expect(plain.shouldBatchLowPriority).toBe(true);
  });
});
