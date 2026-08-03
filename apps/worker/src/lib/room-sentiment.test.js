import { describe, it, expect } from "vitest";
import { scoreReactionMood } from "./room-sentiment.js";

describe("room-sentiment", () => {
  it("scores positive mood from thumbs up", () => {
    const s = scoreReactionMood({ "👍": 5, "❤️": 2 });
    expect(s.mood).toBe("positive");
    expect(s.positive).toBe(7);
  });

  it("returns neutral when empty", () => {
    expect(scoreReactionMood({}).mood).toBe("neutral");
  });
});
