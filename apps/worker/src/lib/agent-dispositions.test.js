import { describe, expect, it } from "vitest";
import {
  getAgentDispositionStats,
  listAgentDispositions,
  normalizeAgentDisposition,
} from "./agent-dispositions.js";

describe("agent-dispositions", () => {
  it("lists canonical disposition codes", () => {
    const list = listAgentDispositions();
    expect(list.some((d) => d.code === "resolved")).toBe(true);
    expect(list.length).toBeGreaterThan(4);
  });

  it("normalizeAgentDisposition validates codes", () => {
    expect(normalizeAgentDisposition("answered").ok).toBe(true);
    expect(normalizeAgentDisposition("invalid").ok).toBe(false);
    expect(normalizeAgentDisposition(null, { required: true }).error).toBe(
      "disposition_required",
    );
  });

  it("getAgentDispositionStats aggregates resolved tasks", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                all: async () => ({
                  results: [
                    { disposition: "answered", count: 3 },
                    { disposition: "legacy_code", count: 1 },
                  ],
                }),
              };
            },
          };
        },
      },
    };
    const stats = await getAgentDispositionStats(env, "proj_1");
    expect(stats.total).toBe(4);
    expect(stats.breakdown.find((r) => r.code === "answered")?.count).toBe(3);
    expect(stats.unknown).toEqual([{ code: "legacy_code", count: 1 }]);
  });
});
