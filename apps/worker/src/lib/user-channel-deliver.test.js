import { describe, expect, it } from "vitest";
import { shouldDeliverOnUserSocket } from "./user-channel-deliver.js";

describe("shouldDeliverOnUserSocket", () => {
  it("passes all events on the full user channel", () => {
    expect(shouldDeliverOnUserSocket("user", { type: "user_event", name: "custom" })).toBe(true);
  });

  it("filters the inbox socket to inbox_updated", () => {
    expect(
      shouldDeliverOnUserSocket("inbox", { type: "user_event", name: "inbox_updated" }),
    ).toBe(true);
    expect(shouldDeliverOnUserSocket("inbox", { type: "user_event", name: "custom" })).toBe(false);
    expect(shouldDeliverOnUserSocket("inbox", { type: "inbox_subscription_succeeded" })).toBe(true);
  });
});
