import { describe, it, expect } from "vitest";
import { kMeansCosine, layoutCartographyPoints, pickClusterCount } from "./chat-cartography.js";

describe("chat-cartography", () => {
  it("picks reasonable cluster counts", () => {
    expect(pickClusterCount(9)).toBeGreaterThanOrEqual(2);
    expect(pickClusterCount(200)).toBeLessThanOrEqual(12);
  });

  it("clusters similar vectors together", () => {
    const a = [1, 0, 0];
    const b = [0.99, 0.01, 0];
    const c = [0, 1, 0];
    const d = [0.01, 0.99, 0];
    const { assignments } = kMeansCosine([a, b, c, d], 2, 10);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[2]).toBe(assignments[3]);
    expect(assignments[0]).not.toBe(assignments[2]);
  });

  it("lays out cluster blobs and member points", () => {
    const items = [
      { messageId: 1, content: "deploy plan", userId: "u1", createdAt: "2026-01-01T00:00:00Z" },
      { messageId: 2, content: "rollback steps", userId: "u2", createdAt: "2026-01-01T00:01:00Z" },
      { messageId: 3, content: "invoice due", userId: "u3", createdAt: "2026-01-02T00:00:00Z" },
    ];
    const layout = layoutCartographyPoints(items, [0, 0, 1], 2);
    expect(layout.clusters).toHaveLength(2);
    expect(layout.points).toHaveLength(3);
    expect(layout.clusters[0].messageCount).toBe(2);
  });

  it("NW-205 suggests handoff for hot billing cluster", async () => {
    const { suggestCartographyRouting } = await import("./chat-cartography.js");
    const map = {
      messageCount: 20,
      clusters: [
        { id: 0, label: "invoice refund charges", messageCount: 12, sampleSnippet: "refund my invoice" },
        { id: 1, label: "general chat", messageCount: 8, sampleSnippet: "hello" },
      ],
      points: Array.from({ length: 12 }, (_, i) => ({
        clusterId: 0,
        userId: i % 2 === 0 ? "u1" : "u2",
      })),
    };
    const routing = suggestCartographyRouting(map, {
      routingCandidates: [
        { userId: "agent-billing", online: true, skills: ["billing", "refunds"] },
        { userId: "agent-eng", online: true, skills: ["engineering"] },
      ],
      hotMinCount: 8,
    });
    expect(routing.hot).toBe(true);
    expect(routing.suggestions[0].suggestedAction).toBe("handoff_agent");
    expect(routing.suggestions[0].suggestedAgentUserId).toBe("agent-billing");
    expect(routing.suggestions[0].suggestedSkills).toContain("billing");
  });
});
