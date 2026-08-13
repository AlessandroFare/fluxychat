import { describe, expect, it, vi } from "vitest";
import { getRoomAudienceScore, scoreReactionBuckets } from "./audience-score.js";

describe("audience-score", () => {
  it("scores positive minus negative over total", () => {
    const result = scoreReactionBuckets([
      { emoji: "👍", count: 8 },
      { emoji: "👎", count: 2 },
    ]);
    expect(result.total).toBe(10);
    expect(result.score).toBe(60);
  });

  it("returns zero when empty", () => {
    expect(scoreReactionBuckets([]).score).toBe(0);
  });

  it("queries D1 for a room window", async () => {
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [{ emoji: "👍", count: 3 }],
            })),
          })),
        })),
      },
    };
    const score = await getRoomAudienceScore(env, {
      projectId: "p1",
      roomId: "room_1",
      windowMinutes: 15,
    });
    expect(score.positive).toBe(3);
    expect(score.score).toBe(100);
  });
});
