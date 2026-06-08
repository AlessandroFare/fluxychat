import { describe, it, expect } from "vitest";
import { isE2eContentEnvelope } from "./room-e2e.js";

describe("room-e2e worker", () => {
  it("detects client E2E envelope JSON in content", () => {
    expect(isE2eContentEnvelope('plain text')).toBe(false);
    expect(
      isE2eContentEnvelope(JSON.stringify({ e2e: 1, v: 1, c: "abc", iv: "def" })),
    ).toBe(true);
  });
});
