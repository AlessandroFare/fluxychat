import { describe, expect, it } from "vitest";
import { evaluateModerationRules } from "./moderation-labels";

describe("evaluateModerationRules", () => {
  it("matches all conditions", () => {
    const hits = evaluateModerationRules(
      [
        {
          name: "block-spam-new-users",
          match: "all",
          conditions: [
            { field: "label", op: "eq", value: "spam" },
            { field: "severity", op: "gt", value: "low" },
          ],
          action: "block",
        },
      ],
      { labels: ["spam"], scores: { spam: 0.9 }, severity: "medium" },
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.action).toBe("block");
  });

  it("supports any match mode", () => {
    const hits = evaluateModerationRules(
      [
        {
          name: "flag-profanity-or-hate",
          match: "any",
          conditions: [
            { field: "label", op: "eq", value: "profanity" },
            { field: "label", op: "eq", value: "hate" },
          ],
          action: "flag",
        },
      ],
      { labels: ["profanity"], scores: {}, severity: "medium" },
    );
    expect(hits).toHaveLength(1);
  });
});
