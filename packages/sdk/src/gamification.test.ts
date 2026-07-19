import { describe, it, expect } from "vitest";
import { createGamification } from "./gamification";

describe("createGamification", () => {
  it("awardXp adds XP to user", () => {
    const g = createGamification();
    g.awardXp("u1", 100, "message sent");
    expect(g.getXp("u1")).toBe(100);
  });

  it("getXp returns 0 for unknown user", () => {
    const g = createGamification();
    expect(g.getXp("unknown")).toBe(0);
  });

  it("accumulates XP across multiple awards", () => {
    const g = createGamification();
    g.awardXp("u1", 50, "login");
    g.awardXp("u1", 200, "thread created");
    expect(g.getXp("u1")).toBe(250);
  });

  it("getHistory returns all XP events", () => {
    const g = createGamification();
    g.awardXp("u1", 10, "reaction");
    const history = g.getHistory("u1");
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe("reaction");
  });

  it("awardBadge adds badge to user", () => {
    const g = createGamification();
    const badge = { id: "b1", name: "First Message" };
    g.awardBadge("u1", badge);
    const badges = g.getBadges("u1");
    expect(badges).toHaveLength(1);
    expect(badges[0].name).toBe("First Message");
  });

  it("does not award duplicate badges", () => {
    const g = createGamification();
    const badge = { id: "b1", name: "First Message" };
    g.awardBadge("u1", badge);
    g.awardBadge("u1", badge);
    expect(g.getBadges("u1")).toHaveLength(1);
  });

  it("getLeaderboard returns sorted entries", () => {
    const g = createGamification();
    g.awardXp("u1", 50, "msg");
    g.awardXp("u2", 200, "thread");
    g.awardXp("u3", 100, "reaction");
    const lb = g.getLeaderboard(3);
    expect(lb).toHaveLength(3);
    expect(lb[0].userId).toBe("u2");
    expect(lb[0].totalXp).toBe(200);
    expect(lb[0].rank).toBe(1);
    expect(lb[1].userId).toBe("u3");
    expect(lb[1].rank).toBe(2);
    expect(lb[2].userId).toBe("u1");
    expect(lb[2].rank).toBe(3);
  });
});
