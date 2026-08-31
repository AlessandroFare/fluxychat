import { describe, expect, it } from "vitest";
import { isPointerLikeClientEventName } from "./client-event-guard";

describe("isPointerLikeClientEventName", () => {
  it("flags pointer-shaped names", () => {
    expect(isPointerLikeClientEventName("cursor")).toBe(true);
    expect(isPointerLikeClientEventName("client-cursor")).toBe(true);
    expect(isPointerLikeClientEventName("pointer-move")).toBe(true);
  });

  it("allows sparse signals", () => {
    expect(isPointerLikeClientEventName("client-ephemeral-dot")).toBe(false);
    expect(isPointerLikeClientEventName("vote-cast")).toBe(false);
  });
});
