import { describe, expect, it } from "vitest";
import { loadHitlFatigueMetrics } from "./hitl-fatigue-metrics.js";

describe("loadHitlFatigueMetrics", () => {
  it("maps D1 aggregates", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind: () => ({
              first: async () => ({ pending: 3, decided_24h: 8, unique_approvers: 2 }),
            }),
          };
        },
      },
    };
    await expect(loadHitlFatigueMetrics(env, "p1")).resolves.toEqual({
      pending: 3,
      decidedLast24h: 8,
      uniqueCurrentApprovers: 2,
    });
  });
});
