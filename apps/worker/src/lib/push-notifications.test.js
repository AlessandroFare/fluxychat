import { describe, expect, it } from "vitest";
import { webPushUrgency } from "./push-notifications.js";

describe("webPushUrgency", () => {
  it("accepts Web Push spec values and falls back to normal", () => {
    expect(webPushUrgency("high")).toBe("high");
    expect(webPushUrgency("low")).toBe("low");
    expect(webPushUrgency("bogus")).toBe("normal");
    expect(webPushUrgency(undefined)).toBe("normal");
  });
});
