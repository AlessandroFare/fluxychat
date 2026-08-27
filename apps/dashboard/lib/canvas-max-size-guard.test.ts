import { describe, expect, it } from "vitest";
import { clampBackingStoreSize, maxCssBox, MAX_CANVAS_AREA, MAX_CANVAS_DIM } from "./canvas-max-size-guard";

describe("clampBackingStoreSize", () => {
  it("keeps a normal board size", () => {
    expect(clampBackingStoreSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it("caps a single edge", () => {
    const out = clampBackingStoreSize(40_000, 800);
    expect(out.width).toBe(MAX_CANVAS_DIM);
    expect(out.height).toBe(800);
  });

  it("caps area so Firefox setTransform stays valid", () => {
    const out = clampBackingStoreSize(16_000, 16_000);
    expect(out.width * out.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    expect(out.width).toBeLessThanOrEqual(MAX_CANVAS_DIM);
  });

  it("treats non-finite sizes as 1", () => {
    expect(clampBackingStoreSize(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ width: 1, height: 1 });
  });
});

describe("maxCssBox", () => {
  it("shrinks CSS box as devicePixelRatio grows", () => {
    const dpr1 = maxCssBox(1);
    const dpr2 = maxCssBox(2);
    expect(dpr2.maxWidth).toBeLessThan(dpr1.maxWidth);
    expect(dpr2.maxWidth * 2).toBeLessThanOrEqual(MAX_CANVAS_DIM);
  });
});
