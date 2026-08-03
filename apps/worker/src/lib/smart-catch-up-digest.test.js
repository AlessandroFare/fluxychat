import { describe, it, expect } from "vitest";
import { rankCatchUpMessages } from "./smart-catch-up-digest.js";

describe("smart-catch-up-digest", () => {
  it("ranks mentions above non-mentions", () => {
    const rows = [
      { id: 1, content: "general update", user_id: "a", created_at: "2026-01-01" },
      { id: 2, content: "@alice please review", user_id: "b", created_at: "2026-01-01" },
    ];
    const ranked = rankCatchUpMessages(rows, "alice");
    expect(ranked[0].id).toBe(2);
  });
});
