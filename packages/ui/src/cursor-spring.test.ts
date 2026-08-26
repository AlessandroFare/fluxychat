import { describe, expect, it } from "vitest";
import { DEFAULT_CURSOR_SPRING, stepSpring } from "./cursor-spring";

describe("stepSpring", () => {
  it("moves toward the target", () => {
    let state = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 40; i += 1) {
      state = stepSpring(state, 100, 50, 0.016, DEFAULT_CURSOR_SPRING);
    }
    expect(state.x).toBeGreaterThan(40);
    expect(state.y).toBeGreaterThan(20);
  });

  it("settles near the target", () => {
    let state = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 240; i += 1) {
      state = stepSpring(state, 80, 80, 0.016);
    }
    expect(Math.abs(state.x - 80)).toBeLessThan(1);
    expect(Math.abs(state.y - 80)).toBeLessThan(1);
  });
});
