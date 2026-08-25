import { describe, it, expect } from "vitest";
import { isRoomContentEnvelope } from "./room-e2e.js";

describe("room-e2e worker", () => {
  it("detects client E2E envelope JSON in content", () => {
    expect(isRoomContentEnvelope('plain text')).toBe(false);
    expect(
      isRoomContentEnvelope(JSON.stringify({ e2e: 1, v: 1, c: "abc", iv: "def" })),
    ).toBe(true);
  });
});
